import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ConflictError, NotFoundError } from '../errors/AppError';
import { TERMINAL_STATUSES } from '../lib/bookingStatus';
import { WebsiteRequestInput } from '../validation/websiteRequest.schema';
import { applyRoomStatuses } from '../lib/roomStatus';
import { sendRequestMail } from './websiteMail.service';

type Line = { roomTypeId: string; name: string; quantity: number; unitPrice: number; capacity: number };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const include = { booking: { select: { id: true, status: true } } };
const privateFields = (row: { accessTokenHash: string; payloadHash: string; [key: string]: unknown }) => {
  const { accessTokenHash: _token, payloadHash: _payload, ...safe } = row;
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
    });
  }
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

export async function submit(input: WebsiteRequestInput, token: string, customerId: string) {
  const accessTokenHash = hash(`${customerId}:${token}`);
  const payloadHash = hash(JSON.stringify(input));
  const existing = await prisma.websiteRequest.findUnique({ where: { accessTokenHash } });
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
  try {
    const row = await prisma.websiteRequest.create({ data: {
      reference: `NL-${randomUUID().toUpperCase()}`, accessTokenHash, payloadHash, customerId,
      name: input.name, email: input.email, phone: input.phone, notes: input.notes,
      arrival: new Date(input.arrival), departure: new Date(input.departure), guests: input.guests,
      lines, totalAmount: depositAmount * nights, depositAmount,
    } });
    const emailSent = await sendRequestMail(row);
    return { ...publicView(row), emailSent };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const retry = await prisma.websiteRequest.findUnique({ where: { accessTokenHash } });
      if (retry && retry.payloadHash === payloadHash) return publicView(retry);
    }
    throw error;
  }
}

function publicView(row: { id: string; reference: string; name: string; arrival: Date; departure: Date; guests: number; lines: Prisma.JsonValue; totalAmount: number; depositAmount: number; status: string; paymentInstructions: string; decisionNote: string; expiresAt: Date | null; createdAt: Date }) {
  // The scheduler may lag by up to a minute: never show payment instructions past the deadline.
  const status = row.status === 'AWAITING_PAYMENT' && row.expiresAt && row.expiresAt <= new Date() ? 'EXPIRED' : row.status;
  return { id: row.id, reference: row.reference, name: row.name, arrival: row.arrival, departure: row.departure, guests: row.guests, lines: row.lines, totalAmount: row.totalAmount, depositAmount: row.depositAmount, status, paymentInstructions: status === 'AWAITING_PAYMENT' ? row.paymentInstructions : '', decisionNote: row.decisionNote, expiresAt: row.expiresAt, createdAt: row.createdAt };
}

export async function listForCustomer(customerId: string) {
  const rows = await prisma.websiteRequest.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' } });
  return rows.map(publicView);
}

export async function list(status: string | undefined, page: number) {
  const where = status ? { status } : {};
  const [data, total] = await Promise.all([
    prisma.websiteRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 20, take: 20, include }),
    prisma.websiteRequest.count({ where }),
  ]);
  return { data: data.map(privateFields), total };
}

export async function approve(id: string, instructions: string, hours: number, actorId: string) {
  await expireRequests();
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "WebsiteRequest" WHERE "id" = ${id} FOR UPDATE`;
    const row = await tx.websiteRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Demande');
    if (row.status !== 'PENDING') throw new ConflictError('Cette demande a déjà été traitée.');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Antananarivo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    if (row.arrival.toISOString().slice(0, 10) < today) throw new ConflictError('La date d’arrivée est dépassée.');
    const lines = row.lines as unknown as Line[];
    const typeIds = lines.map(line => line.roomTypeId);
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Room" WHERE "roomTypeId" IN (${Prisma.join(typeIds)}) ORDER BY "id" FOR UPDATE`);
    const allocated: { roomId: string; roomRate: number; arrival: Date; departure: Date }[] = [];
    for (const line of lines) {
      const free = await tx.room.findMany({ where: { roomTypeId: line.roomTypeId, ...blocking(row.arrival, row.departure) }, orderBy: { id: 'asc' }, take: line.quantity });
      if (free.length < line.quantity) throw new ConflictError(`Chambres insuffisantes pour ${line.name}. Aucune chambre n’a été affectée.`);
      allocated.push(...free.map(room => ({ roomId: room.id, roomRate: line.unitPrice, arrival: row.arrival, departure: row.departure })));
    }
    // Do not attach an unverified web identity to an existing guest's private history.
    const guest = await tx.guest.create({ data: { name: row.name, phone: row.phone } });
    const booking = await tx.booking.create({ data: { guestId: guest.id, createdById: actorId, arrival: row.arrival, departure: row.departure, totalAmount: row.totalAmount, status: 'AWAITING', notes: `${row.reference}\n${row.email}\n${row.notes}`, rooms: { create: allocated } } });
    const arrivalEnd = new Date(`${row.arrival.toISOString().slice(0, 10)}T23:59:59+03:00`);
    const expiresAt = new Date(Math.min(Date.now() + hours * 3600000, arrivalEnd.getTime()));
    const result = await tx.websiteRequest.update({ where: { id }, data: { status: 'AWAITING_PAYMENT', bookingId: booking.id, paymentInstructions: instructions, expiresAt }, include });
    await applyRoomStatuses(allocated.map(room => room.roomId), tx);
    return privateFields(result);
  }, { timeout: 15000 });
  await notify(id);
  return result;
}

export async function reject(id: string, reason: string) {
  const changed = await prisma.websiteRequest.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'REJECTED', decisionNote: reason } });
  if (!changed.count) throw new ConflictError('Cette demande a déjà été traitée ou est introuvable.');
  await notify(id);
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
    return privateFields(await tx.websiteRequest.update({ where: { id }, data: { status: 'CONFIRMED' }, include }));
  });
  await notify(id);
  return result;
}

// Called inside addPayment's transaction: once the full deposit is recorded on a validated deposit
// invoice, the website request confirms itself. Returns the request id so the caller can send the
// email after commit. A paid hold is never expired (see expireRequests), so the deadline is not rechecked.
export async function confirmIfDepositPaid(bookingId: string, tx: Prisma.TransactionClient): Promise<string | null> {
  const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "WebsiteRequest" WHERE "bookingId" = ${bookingId} AND "status" = 'AWAITING_PAYMENT' FOR UPDATE`;
  if (!locked) return null;
  const row = await tx.websiteRequest.findUnique({ where: { id: locked.id } });
  if (!row || row.status !== 'AWAITING_PAYMENT' || await depositPaid(tx, bookingId) < row.depositAmount) return null;
  const booking = await tx.booking.updateMany({ where: { id: bookingId, status: 'AWAITING' }, data: { status: 'CONFIRMED' } });
  if (!booking.count) return null;
  await tx.websiteRequest.update({ where: { id: row.id }, data: { status: 'CONFIRMED' } });
  return row.id;
}

export async function notify(id: string) {
  const row = await prisma.websiteRequest.findUnique({ where: { id } });
  if (row) await sendRequestMail(row);
}

