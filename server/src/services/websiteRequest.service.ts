import { createHash, randomInt } from 'crypto';
import { Prisma, WebsiteRequestStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ConflictError, NotFoundError } from '../errors/AppError';
import { TERMINAL_STATUSES } from '../lib/bookingStatus';
import { WebsiteRequestInput } from '../validation/websiteRequest.schema';
import { applyRoomStatuses } from '../lib/roomStatus';
import { enqueueRequestEmail, kickOutbox } from './websiteEmail.service';
import { cancelInvoiceForBooking } from './invoice.service';
import { proofMeta } from './websiteProof.service';
import { recordEvent } from './websiteEvent.service';
import { kickPush } from './staffPush.service';

type Line = { roomTypeId: string; name: string; quantity: number; unitPrice: number; capacity: number };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const include = { booking: { select: { id: true, status: true } } };
// Admin view only: undelivered follow-up emails, so staff can call the guest when SMTP keeps failing.
const adminInclude = { ...include, proofs: proofMeta, emails: { where: { sentAt: null, attempts: { gt: 0 } }, select: { status: true, attempts: true, lastError: true }, orderBy: { createdAt: 'desc' as const } } };
const privateFields = (row: { idempotencyKeyHash: string; payloadHash: string; [key: string]: unknown }) => {
  const { idempotencyKeyHash: _key, payloadHash: _payload, ...safe } = row;
  return safe;
};
const blocking = (arrival: Date, departure: Date) => ({
  status: { not: 'MAINTENANCE' as const },
  bookings: { none: { arrival: { lt: departure }, departure: { gt: arrival }, booking: { status: { notIn: TERMINAL_STATUSES } } } },
});

export async function expireRequests() {
  const expired = await prisma.websiteRequest.findMany({ where: { status: 'AWAITING_PAYMENT', expiresAt: { lte: new Date() } }, select: { id: true } });
  for (const item of expired) {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "WebsiteRequest" WHERE "id" = ${item.id} FOR UPDATE`;
      const request = await tx.websiteRequest.findUnique({ where: { id: item.id } });
      if (!request || request.status !== 'AWAITING_PAYMENT' || !request.expiresAt || request.expiresAt > new Date()) return;
      if (request.bookingId) {
        // A verified incoming payment takes precedence over the timer. Never release a paid hold.
        const paid = await tx.payment.aggregate({ where: { status: 'COMPLETED', invoice: { bookingId: request.bookingId, kind: 'DEPOSIT', validatedAt: { not: null } } }, _sum: { amount: true } });
        if ((paid._sum.amount ?? 0) > 0) return;
        const rooms = await tx.bookingRoom.findMany({ where: { bookingId: request.bookingId }, select: { roomId: true } });
        await tx.booking.updateMany({ where: { id: request.bookingId, status: 'AWAITING' }, data: { status: 'CANCELLED' } });
        await applyRoomStatuses(rooms.map(room => room.roomId), tx);
      }
      await tx.websiteRequest.update({ where: { id: item.id }, data: { status: 'EXPIRED' } });
      await enqueueRequestEmail(tx, item.id, 'EXPIRED');
      await recordEvent(tx, item.id, 'EXPIRED');
    });
  }
  if (expired.length) kickOutbox(); kickPush();
}

export async function roomTypes() {
  const types = await prisma.roomType.findMany({ where: { rate: { gt: 0 } }, orderBy: { name: 'asc' }, select: { id: true, name: true, rate: true, capacity: true } });
  return types.map(type => ({ id: type.id, name: type.name, price: type.rate, capacity: type.capacity }));
}

// Expiry is handled by the scheduler (every minute), not on public reads: an unauthenticated GET
// must not trigger write transactions.
export async function availability(arrival: string, departure: string) {
  const types = await prisma.roomType.findMany({ orderBy: { name: 'asc' }, include: { rooms: { where: blocking(new Date(arrival), new Date(departure)), select: { id: true, images: true } } } });
  return types.filter(type => type.rooms.length && type.rate > 0).map(type => ({
    id: type.id, name: type.name, price: type.rate, capacity: type.capacity, description: type.description,
    available: type.rooms.length, image: type.rooms.flatMap(room => room.images).find(image => image.startsWith('https://') || image.startsWith('/')) ?? null,
  }));
}

// Short reference the guest copies into a mobile-money payment reason or reads out on the phone:
// 6 characters without look-alikes (0/O, 1/I/L), about a billion combinations. Uniqueness is enforced
// by the database; a collision simply draws another one.
const REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newReference = () => `NL-${Array.from({ length: 6 }, () => REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)]).join('')}`;

export async function submit(input: WebsiteRequestInput, token: string, customerId: string) {
  const idempotencyKeyHash = hash(`${customerId}:${token}`);
  const payloadHash = hash(JSON.stringify(input));
  const existing = await prisma.websiteRequest.findUnique({ where: { idempotencyKeyHash } });
  if (existing) {
    if (existing.payloadHash !== payloadHash) throw new ConflictError('Cette clé a déjà été utilisée pour une autre demande.');
    return publicView(existing);
  }
  const available = await availability(input.arrival, input.departure);
  const lines: Line[] = input.lines.map(line => {
    const type = available.find(type => type.id === line.roomTypeId);
    if (!type || type.available < line.quantity) throw new ConflictError('Disponibilités modifiées. Relancez la recherche.');
    if (line.unitPrice !== type.price) throw new ConflictError('Tarifs modifiés. Relancez la recherche et vérifiez le nouveau total.');
    return { roomTypeId: type.id, name: type.name, quantity: line.quantity, unitPrice: type.price, capacity: type.capacity };
  });
  const capacity = lines.reduce((sum, line) => sum + line.capacity * line.quantity, 0);
  if (capacity < input.guests || lines.reduce((sum, line) => sum + line.quantity, 0) > input.guests) throw new ConflictError('Capacité incompatible avec les voyageurs.');
  const nights = (Date.parse(input.departure) - Date.parse(input.arrival)) / 86400000;
  const depositAmount = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  for (let attempt = 0; ; attempt++) {
    try {
      const row = await prisma.websiteRequest.create({ data: {
        reference: newReference(), idempotencyKeyHash, payloadHash, customerId,
        name: input.name, email: input.email, phone: input.phone, notes: input.notes, locale: input.locale === 'en' ? 'EN' : 'FR',
        arrival: new Date(input.arrival), departure: new Date(input.departure), guests: input.guests,
        lines, totalAmount: depositAmount * nights, depositAmount,
        emails: { create: { status: 'PENDING' } },
        events: { create: { kind: 'REQUEST_RECEIVED' } },
      } });
      kickOutbox(); kickPush();
      return publicView(row);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
      // Same submission sent twice concurrently: return the request the other call created.
      const retry = await prisma.websiteRequest.findUnique({ where: { idempotencyKeyHash } });
      if (retry) {
        if (retry.payloadHash === payloadHash) return publicView(retry);
        throw new ConflictError('Cette clé a déjà été utilisée pour une autre demande.');
      }
      // Otherwise the random reference collided with an existing one: draw another.
      if (attempt >= 4) throw error;
    }
  }
}

type ProofMeta = { id: string; fileName: string; mimeType: string; size: number; note: string; createdAt: Date };
function publicView(row: { proofs?: ProofMeta[]; id: string; reference: string; name: string; arrival: Date; departure: Date; guests: number; lines: Prisma.JsonValue; totalAmount: number; depositAmount: number; status: string; paymentInstructions: string; decisionNote: string; expiresAt: Date | null; createdAt: Date }) {
  // The scheduler may lag by up to a minute: never show payment instructions past the deadline.
  const status = row.status === 'AWAITING_PAYMENT' && row.expiresAt && row.expiresAt <= new Date() ? 'EXPIRED' : row.status;
  return { id: row.id, reference: row.reference, name: row.name, arrival: row.arrival, departure: row.departure, guests: row.guests, lines: row.lines, totalAmount: row.totalAmount, depositAmount: row.depositAmount, status, paymentInstructions: status === 'AWAITING_PAYMENT' ? row.paymentInstructions : '', decisionNote: row.decisionNote, expiresAt: row.expiresAt, createdAt: row.createdAt, proofs: row.proofs ?? [] };
}

export async function listForCustomer(customerId: string) {
  const rows = await prisma.websiteRequest.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, include: { proofs: proofMeta } });
  return rows.map(publicView);
}

export async function list(status: WebsiteRequestStatus | undefined, page: number, search?: string) {
  const where: Prisma.WebsiteRequestWhereInput = {
    ...(status ? { status } : {}),
    // Guest name, or reference (with or without the "NL-" prefix, as read out by the guest).
    ...(search ? { OR: [
      { name: { contains: search, mode: 'insensitive' as const } },
      { reference: { contains: search.replace(/\s+/g, ''), mode: 'insensitive' as const } },
    ] } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.websiteRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 20, take: 20, include: adminInclude }),
    prisma.websiteRequest.count({ where }),
  ]);
  const rows = await Promise.all(data.map(async row => ({ ...privateFields(row), availability: row.status === 'PENDING' ? await freeByLine(row) : null })));
  return { data: rows, total };
}

export async function pendingCount() {
  const [pending, proofs] = await Promise.all([
    prisma.websiteRequest.count({ where: { status: 'PENDING' } }),
    // Awaiting payment with at least one proof uploaded: the manager has a payment to check.
    prisma.websiteRequest.count({ where: { status: 'AWAITING_PAYMENT', proofs: { some: {} } } }),
  ]);
  return { pending, proofs };
}

// Requests made from a website account carry an email proven by the magic link: reuse the guest file
// holding that email (Guest.email is unique) instead of creating a duplicate on every stay. Legacy
// requests without an account have an unverified email: never attach them to an existing guest's history.
async function guestFor(tx: Prisma.TransactionClient, row: { customerId: string | null; email: string; name: string; phone: string }) {
  if (!row.customerId) return tx.guest.create({ data: { name: row.name, phone: row.phone } });
  const existing = await tx.guest.findFirst({ where: { email: { equals: row.email, mode: 'insensitive' } } });
  if (!existing) return tx.guest.create({ data: { name: row.name, phone: row.phone, email: row.email } });
  return existing.phone ? existing : tx.guest.update({ where: { id: existing.id }, data: { phone: row.phone } });
}

const byNumber = (a: { number: string }, b: { number: string }) => a.number.localeCompare(b.number, 'fr', { numeric: true });

// Rooms the manager can pick from when accepting a request: every room of each requested type, with
// its state over the stay (free / already booked / under maintenance).
export async function roomOptions(id: string) {
  const row = await prisma.websiteRequest.findUnique({ where: { id } });
  if (!row) throw new NotFoundError('Demande');
  const lines = row.lines as unknown as Line[];
  const rooms = await prisma.room.findMany({
    where: { roomTypeId: { in: lines.map(line => line.roomTypeId) } },
    select: { id: true, number: true, status: true, roomTypeId: true, bookings: {
      where: { arrival: { lt: row.departure }, departure: { gt: row.arrival }, booking: { status: { notIn: TERMINAL_STATUSES } } },
      select: { booking: { select: { guest: { select: { name: true } } } } }, take: 1,
    } },
  });
  return lines.map(line => ({
    roomTypeId: line.roomTypeId, name: line.name, quantity: line.quantity,
    rooms: rooms.filter(room => room.roomTypeId === line.roomTypeId).sort(byNumber).map(room => ({
      id: room.id, number: room.number,
      state: room.status === 'MAINTENANCE' ? 'maintenance' as const : room.bookings.length ? 'booked' as const : 'free' as const,
      bookedBy: room.bookings[0]?.booking.guest.name ?? null,
    })),
  }));
}

// For the admin list: how many rooms of each requested type are still free, so a conflict between
// two pending requests is visible before clicking "Accept".
async function freeByLine(row: { arrival: Date; departure: Date; lines: Prisma.JsonValue }) {
  const lines = row.lines as unknown as Line[];
  const free = await prisma.room.findMany({ where: { roomTypeId: { in: lines.map(line => line.roomTypeId) }, ...blocking(row.arrival, row.departure) }, select: { roomTypeId: true } });
  return lines.map(line => ({ roomTypeId: line.roomTypeId, name: line.name, requested: line.quantity, free: free.filter(room => room.roomTypeId === line.roomTypeId).length }));
}

export async function approve(id: string, instructions: string, hours: number, roomIds: string[], actorId: string) {
  await expireRequests();
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "WebsiteRequest" WHERE "id" = ${id} FOR UPDATE`;
    const row = await tx.websiteRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Demande');
    if (row.status !== 'PENDING') throw new ConflictError('Cette demande a déjà été traitée.');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Antananarivo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    if (row.arrival.toISOString().slice(0, 10) < today) throw new ConflictError('La date d’arrivée est dépassée.');
    const lines = row.lines as unknown as Line[];
    const ids = [...new Set(roomIds)].sort();
    if (!ids.length) throw new ConflictError(`Choisissez exactement ${lines.map(line => `${line.quantity} chambre(s) ${line.name}`).join(' et ')}.`);
    if (ids.length !== roomIds.length) throw new ConflictError('Une même chambre a été choisie deux fois.');
    // Same lock order (Room ids ascending) as booking creation: concurrent writers wait instead of
    // both passing the availability check.
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Room" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`);
    const chosen = await tx.room.findMany({ where: { id: { in: ids } }, select: { id: true, number: true, roomTypeId: true } });
    if (chosen.length !== ids.length) throw new NotFoundError('Chambre');
    const allocated: { roomId: string; roomRate: number; arrival: Date; departure: Date }[] = [];
    for (const line of lines) {
      const picked = chosen.filter(room => room.roomTypeId === line.roomTypeId);
      if (picked.length !== line.quantity) throw new ConflictError(`Choisissez exactement ${line.quantity} chambre(s) ${line.name}.`);
      allocated.push(...picked.map(room => ({ roomId: room.id, roomRate: line.unitPrice, arrival: row.arrival, departure: row.departure })));
    }
    if (allocated.length !== chosen.length) throw new ConflictError('Une chambre choisie ne correspond à aucun type demandé.');
    const free = await tx.room.findMany({ where: { id: { in: ids }, ...blocking(row.arrival, row.departure) }, select: { id: true } });
    const taken = chosen.filter(room => !free.some(f => f.id === room.id)).sort(byNumber);
    if (taken.length) throw new ConflictError(`Chambre(s) ${taken.map(room => room.number).join(', ')} plus disponible(s) sur ces dates. Choisissez-en une autre.`);
    const guest = await guestFor(tx, row);
    const booking = await tx.booking.create({ data: { guestId: guest.id, createdById: actorId, arrival: row.arrival, departure: row.departure, totalAmount: row.totalAmount, status: 'AWAITING', notes: `${row.reference}\n${row.email}\n${row.notes}`, rooms: { create: allocated } } });
    const arrivalEnd = new Date(`${row.arrival.toISOString().slice(0, 10)}T23:59:59+03:00`);
    const expiresAt = new Date(Math.min(Date.now() + hours * 3600000, arrivalEnd.getTime()));
    const result = await tx.websiteRequest.update({ where: { id }, data: { status: 'AWAITING_PAYMENT', bookingId: booking.id, paymentInstructions: instructions, expiresAt }, include });
    await applyRoomStatuses(allocated.map(room => room.roomId), tx);
    await enqueueRequestEmail(tx, id, 'AWAITING_PAYMENT');
    return privateFields(result);
  }, { timeout: 15000 });
  kickOutbox(); kickPush();
  return result;
}

export async function reject(id: string, reason: string) {
  await prisma.$transaction(async tx => {
    const changed = await tx.websiteRequest.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'REJECTED', decisionNote: reason } });
    if (!changed.count) throw new ConflictError('Cette demande a déjà été traitée ou est introuvable.');
    await enqueueRequestEmail(tx, id, 'REJECTED');
  });
  kickOutbox(); kickPush();
}

async function depositPaid(tx: Prisma.TransactionClient, bookingId: string) {
  const paid = await tx.payment.aggregate({ where: { status: 'COMPLETED', invoice: { bookingId, kind: 'DEPOSIT', validatedAt: { not: null } } }, _sum: { amount: true } });
  return paid._sum.amount ?? 0;
}

export async function confirm(id: string) {
  await expireRequests();
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "WebsiteRequest" WHERE "id" = ${id} FOR UPDATE`;
    const row = await tx.websiteRequest.findUnique({ where: { id } });
    if (!row?.bookingId || row.status !== 'AWAITING_PAYMENT') throw new ConflictError('Cette demande ne peut pas être confirmée.');
    if (await depositPaid(tx, row.bookingId) < row.depositAmount) throw new ConflictError('Enregistrez d’abord l’acompte complet sur une facture d’acompte visée.');
    const booking = await tx.booking.updateMany({ where: { id: row.bookingId, status: 'AWAITING' }, data: { status: 'CONFIRMED' } });
    if (!booking.count) throw new ConflictError('Le séjour associé a été modifié. Vérifiez son statut.');
    await enqueueRequestEmail(tx, id, 'CONFIRMED');
    return privateFields(await tx.websiteRequest.update({ where: { id }, data: { status: 'CONFIRMED' }, include }));
  });
  kickOutbox(); kickPush();
  return result;
}

// Called inside addPayment's transaction: once the full deposit is recorded on a validated deposit
// invoice, the website request confirms itself (email queued in the same transaction; the caller
// kicks the outbox after commit). A paid hold is never expired (see expireRequests), so the deadline
// is not rechecked.
export async function confirmIfDepositPaid(bookingId: string, tx: Prisma.TransactionClient): Promise<boolean> {
  const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "WebsiteRequest" WHERE "bookingId" = ${bookingId} AND "status" = 'AWAITING_PAYMENT' FOR UPDATE`;
  if (!locked) return false;
  const row = await tx.websiteRequest.findUnique({ where: { id: locked.id } });
  if (!row || row.status !== 'AWAITING_PAYMENT' || await depositPaid(tx, bookingId) < row.depositAmount) return false;
  const booking = await tx.booking.updateMany({ where: { id: bookingId, status: 'AWAITING' }, data: { status: 'CONFIRMED' } });
  if (!booking.count) return false;
  await tx.websiteRequest.update({ where: { id: row.id }, data: { status: 'CONFIRMED' } });
  await enqueueRequestEmail(tx, row.id, 'CONFIRMED');
  await recordEvent(tx, row.id, 'DEPOSIT_CONFIRMED');
  return true;
}

// Self-service cancellation from the website account. Only before any money changed hands: a
// confirmed stay or a recorded payment goes through the hotel (refund terms are not defined yet).
export async function cancelByCustomer(id: string, customerId: string) {
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "WebsiteRequest" WHERE "id" = ${id} FOR UPDATE`;
    const row = await tx.websiteRequest.findUnique({ where: { id } });
    if (!row || row.customerId !== customerId) throw new NotFoundError('Demande');
    if (row.status === 'CONFIRMED') throw new ConflictError('Votre séjour est confirmé : contactez l’hôtel pour l’annuler.');
    if (row.status !== 'PENDING' && row.status !== 'AWAITING_PAYMENT') throw new ConflictError('Cette demande ne peut plus être annulée.');
    if (row.bookingId) {
      const payments = await tx.payment.count({ where: { status: 'COMPLETED', invoice: { bookingId: row.bookingId } } });
      if (payments) throw new ConflictError('Un paiement a déjà été enregistré : contactez l’hôtel pour annuler.');
      await cancelInvoiceForBooking(row.bookingId, undefined, tx);
      const rooms = await tx.bookingRoom.findMany({ where: { bookingId: row.bookingId }, select: { roomId: true } });
      await tx.booking.updateMany({ where: { id: row.bookingId, status: 'AWAITING' }, data: { status: 'CANCELLED' } });
      await applyRoomStatuses(rooms.map(room => room.roomId), tx);
    }
    const updated = await tx.websiteRequest.update({ where: { id }, data: { status: 'CANCELLED', decisionNote: 'Annulée à votre demande.' } });
    await enqueueRequestEmail(tx, id, 'CANCELLED');
    await recordEvent(tx, id, 'CANCELLED_BY_GUEST');
    return publicView(updated);
  });
  kickOutbox(); kickPush();
  return result;
}

// Called inside booking.updateStatus when the hotel cancels a stay that came from the website.
export async function cancelForBooking(bookingId: string, tx: Prisma.TransactionClient) {
  const rows = await tx.websiteRequest.findMany({ where: { bookingId, status: { in: ['AWAITING_PAYMENT', 'CONFIRMED'] } }, select: { id: true } });
  for (const row of rows) {
    await tx.websiteRequest.update({ where: { id: row.id }, data: { status: 'CANCELLED', decisionNote: 'Le séjour a été annulé par l’hôtel.' } });
    await enqueueRequestEmail(tx, row.id, 'CANCELLED');
  }
  return rows.length > 0;
}

