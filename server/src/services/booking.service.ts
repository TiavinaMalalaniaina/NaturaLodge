import { BookingStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { applyRoomStatuses } from '../lib/roomStatus';
import { NotFoundError, ConflictError } from '../errors/AppError';
import { BookingInput, BookingListParams, ReassignInput } from '../validation/booking.schema';

const include = {
  guest:     { select: { id: true, name: true, email: true, avatar: true, status: true } },
  rooms:     {
    include: {
      room: {
        select: {
          id:           true,
          number:       true,
          rateOverride: true,
          roomType:     { select: { id: true, name: true, rate: true } },
        },
      },
    },
  },
  createdBy: { select: { id: true, name: true, role: true } },
};

export type EffectiveStatus =
  | 'upcoming'
  | 'due_checkin'
  | 'in_progress'
  | 'overdue'
  | 'checked_out'
  | 'cancelled';

export function computeEffectiveStatus(b: { arrival: Date; departure: Date; status: BookingStatus }): EffectiveStatus {
  const now = new Date();
  if (b.status === 'CANCELLED')   return 'cancelled';
  if (b.status === 'CHECKED_OUT') return 'checked_out';
  if (b.status === 'CHECKED_IN') {
    return now > b.departure ? 'overdue' : 'in_progress';
  }
  if (now < b.arrival) {
    return b.arrival.toDateString() === now.toDateString() ? 'due_checkin' : 'upcoming';
  }
  if (now >= b.arrival && now <= b.departure) return 'due_checkin';
  return 'overdue';
}

export async function list(params: BookingListParams) {
  const { page, limit, status, date, startDate, endDate, search, sort, order } = params;
  const skip = (page - 1) * limit;

  const where = {
    // Par défaut (pas de statut/date/recherche) : cacher les réservations clôturées
    // pour que la liste priorise les séjours en cours/en retard puis à venir. Dès qu'un
    // filtre explicite est posé (statut, date ou recherche), on montre tout ce qui matche.
    ...(status ? { status } : (search || startDate || endDate || date) ? {} : { status: { notIn: ['CHECKED_OUT', 'CANCELLED'] as BookingStatus[] } }),
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
    prisma.booking.findMany({ where, include, orderBy: { [sort]: order }, skip, take: limit }),
    prisma.booking.count({ where }),
  ]);

  const enriched = bookings.map(b => ({
    ...b,
    nights: Math.max(1, Math.round((b.departure.getTime() - b.arrival.getTime()) / 86_400_000)),
    effectiveStatus: computeEffectiveStatus(b),
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
  const booking = await prisma.booking.findUnique({ where: { id }, include });
  if (!booking) throw new NotFoundError('Réservation');
  return { ...booking, effectiveStatus: computeEffectiveStatus(booking) };
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
          booking:  { status: { notIn: ['CANCELLED', 'CHECKED_OUT'] } },
        },
      });
      if (conflict) throw new ConflictError('La chambre est déjà réservée sur cette période');
    }

    const booking = await tx.booking.create({
      data: {
        guestId:     data.guestId,
        createdById,
        arrival,
        departure,
        status:      data.status ?? 'CONFIRMED',
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
      include,
    });

    // Recalcule immédiatement le statut des chambres concernées (ex: réservation
    // avec arrivée aujourd'hui → OCCUPIED tout de suite, sans attendre le scheduler de minuit).
    await applyRoomStatuses(booking.rooms.map(br => br.roomId), tx);

    return booking;
  });
}

export async function updateStatus(id: string, status: BookingStatus) {
  const booking = await prisma.booking.update({
    where: { id },
    data:  { status },
    include,
  });

  const roomIds = booking.rooms.map(br => br.roomId);

  if (status === 'CHECKED_IN') {
    // Check-in direct → OCCUPIED immédiat
    await prisma.room.updateMany({
      where: { id: { in: roomIds }, status: { not: 'MAINTENANCE' } },
      data:  { status: 'OCCUPIED' },
    });
  } else if (status === 'CHECKED_OUT' || status === 'CANCELLED') {
    // Recalculer : une autre réservation active peut déjà couvrir aujourd'hui
    await applyRoomStatuses(roomIds);
  }

  if (status === 'CHECKED_OUT') {
    await prisma.guest.update({
      where: { id: booking.guestId },
      data:  { totalStays: { increment: 1 }, lifetimeValue: { increment: booking.totalAmount } },
    });
  }

  return booking;
}

export async function reassign(bookingId: string, data: ReassignInput) {
  const { oldRoomId, newRoomId } = data;

  // Vérification de conflit + mise à jour de la ligne + recalcul du total/dates + recalcul des
  // statuts des deux chambres dans une seule transaction (auparavant 4+ écritures séquentielles
  // non atomiques, avec une race possible sur la nouvelle chambre/période).
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include });
    if (!booking) throw new NotFoundError('Réservation');

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
        booking:   { status: { notIn: ['CANCELLED', 'CHECKED_OUT'] }, id: { not: bookingId } },
      },
    });
    if (conflict) throw new ConflictError('La chambre cible est déjà réservée sur cette période');

    const newRoomRate = newRoom.rateOverride ?? newRoom.roomType.rate;

    // Mise à jour : chambre, dates et tarif de la ligne
    await tx.bookingRoom.update({
      where: { id: bookingRoom.id },
      data:  { roomId: newRoomId, arrival: newArrival, departure: newDeparture, roomRate: newRoomRate },
    });

    // Recalculer le montant total et la fenêtre globale de la réservation à partir de toutes ses chambres
    const freshRooms = await tx.bookingRoom.findMany({ where: { bookingId } });
    const totalAmount = freshRooms.reduce((sum, br) => {
      const nights = Math.max(1, Math.round((br.departure.getTime() - br.arrival.getTime()) / 86_400_000));
      return sum + br.roomRate * nights;
    }, 0);
    const overallArrival   = freshRooms.reduce((min, br) => br.arrival < min ? br.arrival : min, freshRooms[0].arrival);
    const overallDeparture = freshRooms.reduce((max, br) => br.departure > max ? br.departure : max, freshRooms[0].departure);

    await tx.booking.update({
      where: { id: bookingId },
      data:  { totalAmount, arrival: overallArrival, departure: overallDeparture },
    });

    // Recalculer les statuts des deux chambres
    await applyRoomStatuses([oldRoomId], tx);

    if (booking.status === 'CHECKED_IN') {
      await tx.room.update({ where: { id: newRoomId }, data: { status: 'OCCUPIED' } });
    } else {
      await applyRoomStatuses([newRoomId], tx);
    }

    const updated = await tx.booking.findUnique({ where: { id: bookingId }, include });
    return { ...updated!, effectiveStatus: computeEffectiveStatus(updated!) };
  });
}

export async function remove(id: string): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id }, include: { rooms: true } });
  if (!booking) throw new NotFoundError('Réservation');

  await prisma.booking.delete({ where: { id } });

  await prisma.room.updateMany({
    where: { id: { in: booking.rooms.map(br => br.roomId) } },
    data:  { status: 'AVAILABLE' },
  });
}
