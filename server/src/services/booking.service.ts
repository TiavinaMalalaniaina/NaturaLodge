import { BookingStatus, Role, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { applyRoomStatuses } from '../lib/roomStatus';
import { TERMINAL_STATUSES } from '../lib/bookingStatus';
import { roleHasPermission } from '../lib/permissions';
import { NotFoundError, ConflictError, ForbiddenError } from '../errors/AppError';
import {
  AddBookingRoomExtraInput, AddBookingRoomInput, BookingInput, BookingListParams,
  ReassignInput, UpdateBookingRoomExtraInput,
} from '../validation/booking.schema';
import * as invoiceService from './invoice.service';

// `avatar` et `createdBy` sont sélectionnés nulle part ci-dessous : ni le type client
// (client/src/api/bookings.ts) ni aucune page ne les lisent — retirés des deux formes.
const guestSelect = { id: true, name: true, email: true, status: true };
const roomSelect  = {
  id:           true,
  number:       true,
  rateOverride: true,
  roomType:     { select: { id: true, name: true, rate: true } },
};
// Sélectionné dans les deux formes pour calculer `paymentStatus` côté serveur (computePaymentStatus),
// mais jamais renvoyé tel quel au client (voir la déstructuration `{ invoices, ...rest }` dans `list`).
const invoicesForStatus = {
  select:  { status: true, totalAmount: true },
  orderBy: { issuedAt: 'desc' as const },
  take:    1,
};

// Forme détail (getById + toutes les mutations qui renvoient la réservation à jour) : profondeur
// complète, y compris les notes et les suppléments par chambre, utilisée par BookingDetail.tsx.
const detailInclude = {
  guest: { select: guestSelect },
  rooms: {
    include: {
      room:   { select: roomSelect },
      extras: { include: { extra: true } },
    },
  },
  invoices:     invoicesForStatus,
  bookingNotes: {
    include: { author: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
};

// Forme liste (GET /bookings, jusqu'à 500 lignes pour la grille planning) : ni les notes ni les
// suppléments par chambre ne sont affichés par Reservations.tsx (vue grille ou liste) — seule
// BookingDetail.tsx (une réservation à la fois) en a besoin, via `detailInclude`.
const listInclude = {
  guest:    { select: guestSelect },
  rooms:    { include: { room: { select: roomSelect } } },
  invoices: invoicesForStatus,
};

export type EffectiveStatus =
  | 'upcoming'
  | 'due_checkin'
  | 'in_progress'
  | 'overdue'
  | 'awaiting'
  | 'checked_out_unpaid'
  | 'checked_out_paid'
  | 'closed'
  | 'cancelled';

export type PaymentStatus =
  | 'no_invoice'
  | 'pending'
  | 'partially_paid'
  | 'paid'
  | 'refunded'
  | 'cancelled';

export function computeEffectiveStatus(b: { arrival: Date; departure: Date; status: BookingStatus }): EffectiveStatus {
  const now = new Date();
  if (b.status === 'CANCELLED')          return 'cancelled';
  if (b.status === 'CLOSED')             return 'closed';
  if (b.status === 'CHECKED_OUT_PAID')   return 'checked_out_paid';
  if (b.status === 'CHECKED_OUT_UNPAID') return 'checked_out_unpaid';
  if (b.status === 'CHECKED_OUT')        return 'checked_out_unpaid'; // legacy — défensif, ne devrait plus survenir après le backfill
  if (b.status === 'CHECKED_IN') {
    return now > b.departure ? 'overdue' : 'in_progress';
  }
  if (b.status === 'AWAITING') return 'awaiting';
  if (now < b.arrival) {
    return b.arrival.toDateString() === now.toDateString() ? 'due_checkin' : 'upcoming';
  }
  if (now >= b.arrival && now <= b.departure) return 'due_checkin';
  return 'overdue';
}

// Statut de paiement dérivé de la facture la plus récente de la réservation (voir `include.invoices`
// ci-dessus, limité à 1, triée par date d'émission décroissante). 'no_invoice' si aucune facture
// n'a encore été générée — le cas le plus important à repérer après un check-out.
export function computePaymentStatus(b: { invoices: { status: string }[] }): PaymentStatus {
  const invoice = b.invoices[0];
  if (!invoice) return 'no_invoice';
  return invoice.status.toLowerCase() as PaymentStatus;
}

export async function list(params: BookingListParams) {
  const { page, limit, status, date, startDate, endDate, search, sort, order } = params;
  const skip = (page - 1) * limit;

  const where = {
    // Par défaut (pas de statut/date/recherche) : cacher les réservations clôturées pour que la
    // liste priorise les séjours en cours/en retard puis à venir — sauf CHECKED_OUT_UNPAID, qui
    // reste visible tant qu'il reste un paiement à suivre (l'état de paiement est désormais
    // directement porté par le statut, plus besoin de sous-requête sur les factures). Dès qu'un
    // filtre explicite est posé (statut, date ou recherche), on montre tout ce qui matche.
    ...(status ? { status } : (search || startDate || endDate || date) ? {} : {
      status: { notIn: ['CANCELLED', 'CHECKED_OUT', 'CHECKED_OUT_PAID', 'CLOSED'] as BookingStatus[] },
    }),
    ...(startDate || endDate ? {
      // Chevauchement : une réservation matche si son séjour croise la fenêtre donnée.
      // Une seule borne fournie = fenêtre ouverte de ce côté ("à partir de" / "jusqu'à").
      ...(endDate   ? { arrival:   { lt: new Date(endDate) } }   : {}),
      ...(startDate ? { departure: { gt: new Date(startDate) } } : {}),
    } : date ? {
      arrival:   { lte: new Date(date) },
      departure: { gte: new Date(date) },
    } : {}),
    ...(search ? {
      OR: [
        { guest: { name: { contains: search, mode: 'insensitive' as const } } },
        { rooms: { some: { room: { number: { contains: search, mode: 'insensitive' as const } } } } },
      ],
    } : {}),
  };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({ where, include: listInclude, orderBy: { [sort]: order }, skip, take: limit }),
    prisma.booking.count({ where }),
  ]);

  const enriched = bookings.map(({ invoices, ...b }) => ({
    ...b,
    nights: Math.max(1, Math.round((b.departure.getTime() - b.arrival.getTime()) / 86_400_000)),
    effectiveStatus: computeEffectiveStatus(b),
    paymentStatus:   computePaymentStatus({ invoices }),
  }));

  return {
    data: enriched,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}

export async function getById(id: string) {
  const booking = await prisma.booking.findUnique({ where: { id }, include: detailInclude });
  if (!booking) throw new NotFoundError('Réservation');
  const { invoices, ...rest } = booking;
  return { ...rest, effectiveStatus: computeEffectiveStatus(booking), paymentStatus: computePaymentStatus({ invoices }) };
}

export async function create(data: BookingInput, createdById: string) {
  const arrival   = new Date(data.arrival);
  const departure = new Date(data.departure);

  if (departure <= arrival) throw new ConflictError("La date de départ doit être après l'arrivée");

  // Vérification des conflits + création + recalcul de statut dans une seule transaction :
  // empêche deux créations concurrentes de passer toutes les deux la vérification et de
  // double-réserver la même chambre.
  return prisma.$transaction(async (tx) => {
    for (const entry of data.rooms) {
      const room = await tx.room.findUnique({
        where:  { id: entry.roomId },
        select: { status: true, number: true },
      });
      if (room?.status === 'MAINTENANCE') {
        throw new ConflictError(`La chambre ${room.number} est en maintenance et ne peut pas être réservée.`);
      }

      const roomArrival   = entry.arrival   ? new Date(entry.arrival)   : arrival;
      const roomDeparture = entry.departure ? new Date(entry.departure) : departure;

      const conflict = await tx.bookingRoom.findFirst({
        where: {
          roomId:   entry.roomId,
          arrival:  { lt: roomDeparture },
          departure: { gt: roomArrival },
          booking:  { status: { notIn: TERMINAL_STATUSES } },
        },
      });
      if (conflict) throw new ConflictError('La chambre est déjà réservée sur cette période');
    }

    let booking = await tx.booking.create({
      data: {
        guestId:     data.guestId,
        createdById,
        arrival,
        departure,
        status:      data.status ?? 'AWAITING',
        totalAmount: data.totalAmount,
        notes:       data.notes,
        rooms: {
          create: data.rooms.map(entry => ({
            roomId:   entry.roomId,
            roomRate: entry.roomRate,
            arrival:  entry.arrival   ? new Date(entry.arrival)   : arrival,
            departure: entry.departure ? new Date(entry.departure) : departure,
          })),
        },
      },
      include: detailInclude,
    });

    // Suppléments par chambre, choisis dès la création de la réservation.
    const hasExtras = data.rooms.some(entry => entry.extras && entry.extras.length > 0);
    if (hasExtras) {
      for (const entry of data.rooms) {
        if (!entry.extras || entry.extras.length === 0) continue;
        const bookingRoom = booking.rooms.find(br => br.roomId === entry.roomId);
        if (!bookingRoom) continue;

        for (const extraEntry of entry.extras) {
          const extra = await tx.extra.findUnique({ where: { id: extraEntry.extraId } });
          if (!extra) throw new NotFoundError('Supplément');
          await tx.bookingRoomExtra.create({
            data: {
              bookingRoomId: bookingRoom.id,
              extraId:       extraEntry.extraId,
              quantity:      extraEntry.quantity,
              unitPrice:     extra.price,
              pricing:       extra.pricing,
            },
          });
        }
      }

      // Le total fourni par le client ne compte pas les suppléments — recalcul autoritaire côté
      // serveur à partir des chambres + suppléments réellement créés (même logique que
      // reassign/addRoom/removeRoom).
      await recomputeBookingAggregate(tx, booking.id);
      booking = (await tx.booking.findUnique({ where: { id: booking.id }, include: detailInclude }))!;
    }

    // Recalcule immédiatement le statut des chambres concernées (ex: réservation
    // avec arrivée aujourd'hui → OCCUPIED tout de suite, sans attendre le scheduler de minuit).
    await applyRoomStatuses(booking.rooms.map(br => br.roomId), tx);

    return { ...booking, paymentStatus: computePaymentStatus(booking) };
  });
}

// Statuts qu'un appelant peut demander via PATCH /:id/status. 'CHECKED_OUT' est une action, pas un
// état persisté : le check-out se résout toujours vers CHECKED_OUT_UNPAID/CHECKED_OUT_PAID selon le
// paiement au moment du geste (voir updateStatus ci-dessous). CHECKED_OUT_UNPAID/CHECKED_OUT_PAID/
// CLOSED ne sont donc jamais acceptés ici — CLOSED passe uniquement par `closeBooking` (réservé
// manager/admin, voir routes/bookings.ts can('bookings.close')).
export type RequestedBookingStatus = 'CONFIRMED' | 'CHECKED_IN' | 'AWAITING' | 'CANCELLED' | 'CHECKED_OUT';

// Transactionnelle : le passage en CANCELLED annule aussi la facture de la réservation s'il y en
// a une (voir invoiceService.cancelInvoiceForBooking) — les deux doivent réussir ou échouer
// ensemble, sinon une réservation annulée pourrait laisser une facture active derrière elle.
export async function updateStatus(id: string, requestedStatus: RequestedBookingStatus, actingUserRole: Role, actingUserId?: string) {
  return prisma.$transaction(async (tx) => {
    let status: BookingStatus = requestedStatus;
    if (requestedStatus === 'CHECKED_OUT') {
      const current = await tx.booking.findUnique({ where: { id }, include: { invoices: invoicesForStatus } });
      if (!current) throw new NotFoundError('Réservation');
      const isPaid = computePaymentStatus(current) === 'paid';
      // Check-outer une réservation encore impayée/partiellement payée requiert la permission
      // `bookings.checkout_unpaid` (ADMIN/MANAGER par défaut, configurable via l'écran Permissions)
      // — pas un contrôle de rôle codé en dur.
      if (!isPaid && !(await roleHasPermission(actingUserRole, 'bookings.checkout_unpaid'))) {
        throw new ForbiddenError('Seuls un manager ou un administrateur peuvent check-outer une réservation impayée ou partiellement payée');
      }
      status = isPaid ? 'CHECKED_OUT_PAID' : 'CHECKED_OUT_UNPAID';
    }

    const booking = await tx.booking.update({
      where: { id },
      data:  { status },
      include: detailInclude,
    });

    const roomIds = booking.rooms.map(br => br.roomId);
    const isCheckout = status === 'CHECKED_OUT_UNPAID' || status === 'CHECKED_OUT_PAID';

    if (status === 'CHECKED_IN') {
      // Check-in direct → OCCUPIED immédiat
      await tx.room.updateMany({
        where: { id: { in: roomIds }, status: { not: 'MAINTENANCE' } },
        data:  { status: 'OCCUPIED' },
      });
    } else if (isCheckout || status === 'CANCELLED') {
      // Recalculer : une autre réservation active peut déjà couvrir aujourd'hui
      await applyRoomStatuses(roomIds, tx);
    }

    if (isCheckout) {
      // Ne crédite plus lifetimeValue ici : ce montant coté n'a aucune garantie de correspondre à ce
      // qui est réellement facturé/payé. lifetimeValue est désormais crédité au moment du paiement
      // réel (voir invoice.service.ts: addPayment/voidPayment), pas au check-out.
      await tx.guest.update({
        where: { id: booking.guestId },
        data:  { totalStays: { increment: 1 } },
      });
    }

    if (status === 'CANCELLED') {
      await invoiceService.cancelInvoiceForBooking(id, actingUserId, tx);
    }

    return { ...booking, paymentStatus: computePaymentStatus(booking) };
  });
}

// Dernière étape, manuelle et réservée manager/admin (can('bookings.close')) : archive
// définitivement une réservation déjà terminée ET soldée. Refuse tout autre point de départ —
// notamment CHECKED_OUT_UNPAID, qu'il faut d'abord solder (le paiement rebascule automatiquement
// vers CHECKED_OUT_PAID, voir `resyncCheckoutPaymentStatus`).
export async function closeBooking(id: string) {
  const booking = await prisma.booking.findUnique({ where: { id }, include: detailInclude });
  if (!booking) throw new NotFoundError('Réservation');
  if (booking.status !== 'CHECKED_OUT_PAID') {
    throw new ConflictError('La réservation doit être « Terminée et payée » avant de pouvoir être clôturée');
  }

  const updated = await prisma.booking.update({ where: { id }, data: { status: 'CLOSED' }, include: detailInclude });
  return { ...updated, effectiveStatus: computeEffectiveStatus(updated), paymentStatus: computePaymentStatus(updated) };
}

// Appelé après tout enregistrement/annulation de paiement (invoice.service.ts addPayment/voidPayment)
// pour garder le statut de réservation synchronisé avec l'état de paiement réel — sans ce resync,
// une réservation check-outée impayée resterait bloquée sur CHECKED_OUT_UNPAID même une fois soldée.
// Ne touche jamais CLOSED (étape finale) ni les réservations encore actives (rien à resynchroniser).
export async function resyncCheckoutPaymentStatus(bookingId: string, tx: Prisma.TransactionClient): Promise<void> {
  const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { invoices: invoicesForStatus } });
  if (!booking) return;
  if (booking.status !== 'CHECKED_OUT_UNPAID' && booking.status !== 'CHECKED_OUT_PAID') return;

  const resolved = computePaymentStatus(booking) === 'paid' ? 'CHECKED_OUT_PAID' : 'CHECKED_OUT_UNPAID';
  if (resolved !== booking.status) {
    await tx.booking.update({ where: { id: bookingId }, data: { status: resolved } });
  }
}

// Recalcule le montant total et l'enveloppe (arrival/departure) globale de la réservation à
// partir de toutes ses chambres actuelles (tarif + suppléments). Appelé après toute mutation des
// lignes BookingRoom/BookingRoomExtra (reassign, addRoom, removeRoom, extras) pour garder Booking
// cohérent avec ses lignes, puis resynchronise toute facture déjà générée (voir invoice.service.ts).
async function recomputeBookingAggregate(tx: Prisma.TransactionClient, bookingId: string): Promise<void> {
  const freshRooms = await tx.bookingRoom.findMany({ where: { bookingId }, include: { extras: true } });
  const totalAmount = freshRooms.reduce((sum, br) => {
    const nights = Math.max(1, Math.round((br.departure.getTime() - br.arrival.getTime()) / 86_400_000));
    const roomTotal = br.roomRate * nights;
    const extrasTotal = br.extras.reduce((s, e) => s + e.unitPrice * e.quantity * (e.pricing === 'PER_NIGHT' ? nights : 1), 0);
    return sum + roomTotal + extrasTotal;
  }, 0);
  const overallArrival   = freshRooms.reduce((min, br) => br.arrival < min ? br.arrival : min, freshRooms[0].arrival);
  const overallDeparture = freshRooms.reduce((max, br) => br.departure > max ? br.departure : max, freshRooms[0].departure);

  await tx.booking.update({
    where: { id: bookingId },
    data:  { totalAmount, arrival: overallArrival, departure: overallDeparture },
  });

  await invoiceService.syncInvoiceWithBooking(tx, bookingId);
}

// CANCELLED/CLOSED restent bloqués pour tout le monde, sans exception. Une réservation
// check-outée mais pas encore clôturée reste modifiable par qui a la permission
// `bookings.modify_after_checkout` (ADMIN/MANAGER par défaut, configurable via l'écran
// Permissions) — pas un contrôle de rôle codé en dur, comme le reste du système d'autorisation.
const CHECKED_OUT_NOT_CLOSED: BookingStatus[] = ['CHECKED_OUT', 'CHECKED_OUT_UNPAID', 'CHECKED_OUT_PAID'];

async function assertBookingModifiable(status: BookingStatus, actingUserRole: Role): Promise<void> {
  if (status === 'CANCELLED' || status === 'CLOSED') {
    throw new ConflictError('Impossible de modifier une réservation clôturée');
  }
  if (CHECKED_OUT_NOT_CLOSED.includes(status) && !(await roleHasPermission(actingUserRole, 'bookings.modify_after_checkout'))) {
    throw new ForbiddenError('Seuls un manager ou un administrateur peuvent modifier une réservation déjà check-outée');
  }
}

export async function reassign(bookingId: string, data: ReassignInput, actingUserRole: Role) {
  const { oldRoomId, newRoomId } = data;

  // Vérification de conflit + mise à jour de la ligne + recalcul du total/dates + recalcul des
  // statuts des deux chambres dans une seule transaction (auparavant 4+ écritures séquentielles
  // non atomiques, avec une race possible sur la nouvelle chambre/période).
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: detailInclude });
    if (!booking) throw new NotFoundError('Réservation');
    await assertBookingModifiable(booking.status, actingUserRole);

    const bookingRoom = booking.rooms.find(br => br.roomId === oldRoomId);
    if (!bookingRoom) throw new NotFoundError('Chambre dans cette réservation');

    // Nouvelles dates (par défaut : celles de la ligne existante — reassignation "chambre seule")
    const newArrival   = data.arrival   ? new Date(data.arrival)   : bookingRoom.arrival;
    const newDeparture = data.departure ? new Date(data.departure) : bookingRoom.departure;
    if (newDeparture <= newArrival) throw new ConflictError("La date de départ doit être après l'arrivée");

    // Valider la nouvelle chambre
    const newRoom = await tx.room.findUnique({
      where:  { id: newRoomId },
      select: { status: true, number: true, rateOverride: true, roomType: { select: { rate: true } } },
    });
    if (!newRoom) throw new NotFoundError('Chambre cible');
    if (newRoom.status === 'MAINTENANCE') throw new ConflictError(`La chambre ${newRoom.number} est en maintenance`);

    // Vérifier l'absence de conflit sur la nouvelle chambre / nouvelle période
    // (exclut la ligne qu'on est en train de déplacer, pour permettre de garder la même chambre en ne changeant que les dates)
    const conflict = await tx.bookingRoom.findFirst({
      where: {
        roomId:    newRoomId,
        id:        { not: bookingRoom.id },
        arrival:   { lt: newDeparture },
        departure: { gt: newArrival },
        booking:   { status: { notIn: TERMINAL_STATUSES }, id: { not: bookingId } },
      },
    });
    if (conflict) throw new ConflictError('La chambre cible est déjà réservée sur cette période');

    const newRoomRate = data.roomRate ?? (newRoom.rateOverride ?? newRoom.roomType.rate);

    // Mise à jour : chambre, dates et tarif de la ligne
    await tx.bookingRoom.update({
      where: { id: bookingRoom.id },
      data:  { roomId: newRoomId, arrival: newArrival, departure: newDeparture, roomRate: newRoomRate },
    });

    await recomputeBookingAggregate(tx, bookingId);

    // Recalculer les statuts des deux chambres
    await applyRoomStatuses([oldRoomId], tx);

    if (booking.status === 'CHECKED_IN') {
      await tx.room.update({ where: { id: newRoomId }, data: { status: 'OCCUPIED' } });
    } else {
      await applyRoomStatuses([newRoomId], tx);
    }

    const updated = await tx.booking.findUnique({ where: { id: bookingId }, include: detailInclude });
    return { ...updated!, effectiveStatus: computeEffectiveStatus(updated!), paymentStatus: computePaymentStatus(updated!) };
  });
}

export async function addRoom(bookingId: string, data: AddBookingRoomInput, actingUserRole: Role) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: detailInclude });
    if (!booking) throw new NotFoundError('Réservation');
    await assertBookingModifiable(booking.status, actingUserRole);

    const arrival   = data.arrival   ? new Date(data.arrival)   : booking.arrival;
    const departure = data.departure ? new Date(data.departure) : booking.departure;
    if (departure <= arrival) throw new ConflictError("La date de départ doit être après l'arrivée");

    const room = await tx.room.findUnique({
      where:  { id: data.roomId },
      select: { status: true, number: true, rateOverride: true, roomType: { select: { rate: true } } },
    });
    if (!room) throw new NotFoundError('Chambre');
    if (room.status === 'MAINTENANCE') throw new ConflictError(`La chambre ${room.number} est en maintenance`);

    const conflict = await tx.bookingRoom.findFirst({
      where: {
        roomId:   data.roomId,
        arrival:  { lt: departure },
        departure: { gt: arrival },
        booking:  { status: { notIn: TERMINAL_STATUSES } },
      },
    });
    if (conflict) throw new ConflictError('La chambre est déjà réservée sur cette période');

    const roomRate = data.roomRate ?? (room.rateOverride ?? room.roomType.rate);

    await tx.bookingRoom.create({
      data: { bookingId, roomId: data.roomId, roomRate, arrival, departure },
    });

    await recomputeBookingAggregate(tx, bookingId);

    if (booking.status === 'CHECKED_IN') {
      await tx.room.update({ where: { id: data.roomId }, data: { status: 'OCCUPIED' } });
    } else {
      await applyRoomStatuses([data.roomId], tx);
    }

    const updated = await tx.booking.findUnique({ where: { id: bookingId }, include: detailInclude });
    return { ...updated!, effectiveStatus: computeEffectiveStatus(updated!), paymentStatus: computePaymentStatus(updated!) };
  });
}

export async function removeRoom(bookingId: string, roomId: string, actingUserRole: Role) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: detailInclude });
    if (!booking) throw new NotFoundError('Réservation');
    await assertBookingModifiable(booking.status, actingUserRole);

    const bookingRoom = booking.rooms.find(br => br.roomId === roomId);
    if (!bookingRoom) throw new NotFoundError('Chambre dans cette réservation');

    if (booking.rooms.length <= 1) {
      throw new ConflictError('Impossible de retirer la dernière chambre — annulez la réservation à la place');
    }

    await tx.bookingRoom.delete({ where: { id: bookingRoom.id } });

    await recomputeBookingAggregate(tx, bookingId);
    await applyRoomStatuses([roomId], tx);

    const updated = await tx.booking.findUnique({ where: { id: bookingId }, include: detailInclude });
    return { ...updated!, effectiveStatus: computeEffectiveStatus(updated!), paymentStatus: computePaymentStatus(updated!) };
  });
}

export async function addExtraToRoom(bookingId: string, roomId: string, data: AddBookingRoomExtraInput, actingUserRole: Role) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: detailInclude });
    if (!booking) throw new NotFoundError('Réservation');
    await assertBookingModifiable(booking.status, actingUserRole);

    const bookingRoom = booking.rooms.find(br => br.roomId === roomId);
    if (!bookingRoom) throw new NotFoundError('Chambre dans cette réservation');

    const extra = await tx.extra.findUnique({ where: { id: data.extraId } });
    if (!extra) throw new NotFoundError('Supplément');

    const existing = bookingRoom.extras.find(e => e.extraId === data.extraId);
    if (existing) {
      // Cliquer à nouveau sur le même supplément augmente juste la quantité, plus naturel côté UI
      // qu'une erreur de conflit sur la contrainte unique (bookingRoomId, extraId).
      await tx.bookingRoomExtra.update({
        where: { id: existing.id },
        data:  { quantity: existing.quantity + data.quantity },
      });
    } else {
      await tx.bookingRoomExtra.create({
        data: {
          bookingRoomId: bookingRoom.id,
          extraId:       data.extraId,
          quantity:      data.quantity,
          unitPrice:     extra.price,
          pricing:       extra.pricing,
        },
      });
    }

    await recomputeBookingAggregate(tx, bookingId);

    const updated = await tx.booking.findUnique({ where: { id: bookingId }, include: detailInclude });
    return { ...updated!, effectiveStatus: computeEffectiveStatus(updated!), paymentStatus: computePaymentStatus(updated!) };
  });
}

export async function updateExtraQuantity(bookingId: string, roomId: string, extraId: string, data: UpdateBookingRoomExtraInput, actingUserRole: Role) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: detailInclude });
    if (!booking) throw new NotFoundError('Réservation');
    await assertBookingModifiable(booking.status, actingUserRole);

    const bookingRoom = booking.rooms.find(br => br.roomId === roomId);
    if (!bookingRoom) throw new NotFoundError('Chambre dans cette réservation');

    const line = bookingRoom.extras.find(e => e.extraId === extraId);
    if (!line) throw new NotFoundError('Supplément sur cette chambre');

    await tx.bookingRoomExtra.update({ where: { id: line.id }, data: { quantity: data.quantity } });

    await recomputeBookingAggregate(tx, bookingId);

    const updated = await tx.booking.findUnique({ where: { id: bookingId }, include: detailInclude });
    return { ...updated!, effectiveStatus: computeEffectiveStatus(updated!), paymentStatus: computePaymentStatus(updated!) };
  });
}

export async function removeExtraFromRoom(bookingId: string, roomId: string, extraId: string, actingUserRole: Role) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: detailInclude });
    if (!booking) throw new NotFoundError('Réservation');
    await assertBookingModifiable(booking.status, actingUserRole);

    const bookingRoom = booking.rooms.find(br => br.roomId === roomId);
    if (!bookingRoom) throw new NotFoundError('Chambre dans cette réservation');

    const line = bookingRoom.extras.find(e => e.extraId === extraId);
    if (!line) throw new NotFoundError('Supplément sur cette chambre');

    await tx.bookingRoomExtra.delete({ where: { id: line.id } });

    await recomputeBookingAggregate(tx, bookingId);

    const updated = await tx.booking.findUnique({ where: { id: bookingId }, include: detailInclude });
    return { ...updated!, effectiveStatus: computeEffectiveStatus(updated!), paymentStatus: computePaymentStatus(updated!) };
  });
}

export async function remove(id: string): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id }, include: { rooms: true } });
  if (!booking) throw new NotFoundError('Réservation');
  if (TERMINAL_STATUSES.includes(booking.status)) {
    throw new ConflictError('Impossible de modifier une réservation clôturée');
  }

  await prisma.booking.delete({ where: { id } });

  await prisma.room.updateMany({
    where: { id: { in: booking.rooms.map(br => br.roomId) } },
    data:  { status: 'AVAILABLE' },
  });
}

export function addBookingNote(bookingId: string, content: string, authorId: string) {
  return prisma.bookingNote.create({
    data: { content, bookingId, authorId },
    include: { author: { select: { id: true, name: true, role: true } } },
  });
}

export async function removeBookingNote(bookingId: string, noteId: string): Promise<void> {
  const note = await prisma.bookingNote.findUnique({ where: { id: noteId } });
  if (!note || note.bookingId !== bookingId) throw new NotFoundError('BookingNote');
  await prisma.bookingNote.delete({ where: { id: noteId } });
}

