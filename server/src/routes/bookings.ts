import { Router, Response } from 'express';
import { z } from 'zod';
import { BookingStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { applyRoomStatuses } from '../lib/roomStatus';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

export const bookingsRouter = Router();
bookingsRouter.use(authenticate);

const roomEntrySchema = z.object({
  roomId:   z.string().min(1),
  roomRate: z.number().int().positive(),
  arrival:  z.string().datetime().optional(),
  departure: z.string().datetime().optional(),
});

const bookingSchema = z.object({
  guestId:     z.string().min(1),
  arrival:     z.string().datetime(),
  departure:   z.string().datetime(),
  rooms:       z.array(roomEntrySchema).min(1),
  status:      z.nativeEnum(BookingStatus).optional(),
  totalAmount: z.number().int().positive(),
  notes:       z.string().optional(),
});

const include = {
  guest:     { select: { id: true, name: true, email: true, avatar: true, status: true } },
  rooms:     {
    include: {
      room: {
        select: {
          id:           true,
          number:       true,
          rateOverride: true,
          roomType:     { select: { id: true, name: true, category: true, rate: true } },
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

function computeEffectiveStatus(b: { arrival: Date; departure: Date; status: BookingStatus }): EffectiveStatus {
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

const paginationSchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(500).default(20),
  status:    z.nativeEnum(BookingStatus).optional(),
  date:      z.string().optional(),
  startDate: z.string().optional(),
  endDate:   z.string().optional(),
  search:    z.string().optional(),
  sort:      z.enum(['arrival', 'departure', 'createdAt', 'totalAmount']).default('arrival'),
  order:     z.enum(['asc', 'desc']).default('asc'),
});

bookingsRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { page, limit, status, date, startDate, endDate, search, sort, order } = parsed.data;
  const skip = (page - 1) * limit;

  const where = {
    // Par défaut (pas de statut choisi, pas de recherche) : cacher les réservations
    // clôturées pour que la liste priorise les séjours en cours/en retard puis à venir.
    ...(status ? { status } : search ? {} : { status: { notIn: ['CHECKED_OUT', 'CANCELLED'] as BookingStatus[] } }),
    ...(startDate && endDate ? {
      arrival:   { lt: new Date(endDate) },
      departure: { gt: new Date(startDate) },
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

  res.json({
    data: enriched,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
});

bookingsRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, include });
  if (!booking) { res.status(404).json({ error: 'Réservation introuvable' }); return; }
  res.json({ ...booking, effectiveStatus: computeEffectiveStatus(booking) });
});

bookingsRouter.post('/', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const arrival   = new Date(parsed.data.arrival);
  const departure = new Date(parsed.data.departure);

  if (departure <= arrival) {
    res.status(400).json({ error: "La date de départ doit être après l'arrivée" });
    return;
  }

  // Vérifier chaque chambre
  for (const entry of parsed.data.rooms) {
    const room = await prisma.room.findUnique({
      where:  { id: entry.roomId },
      select: { status: true, number: true },
    });
    if (room?.status === 'MAINTENANCE') {
      res.status(409).json({ error: `La chambre ${room.number} est en maintenance et ne peut pas être réservée.` });
      return;
    }

    const roomArrival   = entry.arrival   ? new Date(entry.arrival)   : arrival;
    const roomDeparture = entry.departure ? new Date(entry.departure) : departure;

    const conflict = await prisma.bookingRoom.findFirst({
      where: {
        roomId:   entry.roomId,
        arrival:  { lt: roomDeparture },
        departure: { gt: roomArrival },
        booking:  { status: { notIn: ['CANCELLED', 'CHECKED_OUT'] } },
      },
    });
    if (conflict) {
      res.status(409).json({ error: `La chambre est déjà réservée sur cette période` });
      return;
    }
  }

  const booking = await prisma.booking.create({
    data: {
      guestId:     parsed.data.guestId,
      createdById: req.user!.id,
      arrival,
      departure,
      status:      parsed.data.status ?? 'CONFIRMED',
      totalAmount: parsed.data.totalAmount,
      notes:       parsed.data.notes,
      rooms: {
        create: parsed.data.rooms.map(entry => ({
          roomId:   entry.roomId,
          roomRate: entry.roomRate,
          arrival:  entry.arrival   ? new Date(entry.arrival)   : arrival,
          departure: entry.departure ? new Date(entry.departure) : departure,
        })),
      },
    },
    include,
  });

  // Pas de changement de statut chambre à la création :
  // le scheduler de minuit mettra OCCUPIED le jour de l'arrivée.

  res.status(201).json(booking);
});

bookingsRouter.patch('/:id/status', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ status: z.nativeEnum(BookingStatus) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const booking = await prisma.booking.update({
    where: { id: req.params.id },
    data:  { status: parsed.data.status },
    include,
  });

  const roomIds = booking.rooms.map(br => br.roomId);

  if (parsed.data.status === 'CHECKED_IN') {
    // Check-in direct → OCCUPIED immédiat
    await prisma.room.updateMany({
      where: { id: { in: roomIds }, status: { not: 'MAINTENANCE' } },
      data:  { status: 'OCCUPIED' },
    });
  } else if (parsed.data.status === 'CHECKED_OUT' || parsed.data.status === 'CANCELLED') {
    // Recalculer : une autre réservation active peut déjà couvrir aujourd'hui
    await applyRoomStatuses(roomIds);
  }

  if (parsed.data.status === 'CHECKED_OUT') {
    await prisma.guest.update({
      where: { id: booking.guestId },
      data:  { totalStays: { increment: 1 }, lifetimeValue: { increment: booking.totalAmount } },
    });
  }

  res.json(booking);
});

// PATCH /bookings/:id/reassign  ── remplacer une chambre dans la réservation
bookingsRouter.patch('/:id/reassign', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({
    oldRoomId: z.string().min(1),
    newRoomId: z.string().min(1),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { oldRoomId, newRoomId } = parsed.data;

  const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, include });
  if (!booking) { res.status(404).json({ error: 'Réservation introuvable' }); return; }

  // Trouver le BookingRoom à remplacer
  const bookingRoom = booking.rooms.find(br => br.roomId === oldRoomId);
  if (!bookingRoom) { res.status(404).json({ error: 'Chambre introuvable dans cette réservation' }); return; }

  // Valider la nouvelle chambre
  const newRoom = await prisma.room.findUnique({ where: { id: newRoomId }, select: { status: true, number: true } });
  if (!newRoom)                          { res.status(404).json({ error: 'Chambre cible introuvable' }); return; }
  if (newRoom.status === 'MAINTENANCE')  { res.status(409).json({ error: `La chambre ${newRoom.number} est en maintenance` }); return; }

  // Vérifier l'absence de conflit sur la nouvelle chambre
  const conflict = await prisma.bookingRoom.findFirst({
    where: {
      roomId:    newRoomId,
      arrival:   { lt: bookingRoom.departure },
      departure: { gt: bookingRoom.arrival },
      booking:   { status: { notIn: ['CANCELLED', 'CHECKED_OUT'] }, id: { not: req.params.id } },
    },
  });
  if (conflict) { res.status(409).json({ error: 'La chambre cible est déjà réservée sur cette période' }); return; }

  // Mise à jour : remplacer la chambre dans le BookingRoom
  await prisma.bookingRoom.update({
    where: { id: bookingRoom.id },
    data:  { roomId: newRoomId },
  });

  // Recalculer les statuts des deux chambres
  await applyRoomStatuses([oldRoomId]);

  if (booking.status === 'CHECKED_IN') {
    await prisma.room.update({ where: { id: newRoomId }, data: { status: 'OCCUPIED' } });
  } else {
    await applyRoomStatuses([newRoomId]);
  }

  const updated = await prisma.booking.findUnique({ where: { id: req.params.id }, include });
  res.json({ ...updated, effectiveStatus: computeEffectiveStatus(updated!) });
});

bookingsRouter.delete('/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { rooms: true } });
  if (!booking) { res.status(404).json({ error: 'Réservation introuvable' }); return; }

  await prisma.booking.delete({ where: { id: req.params.id } });

  await prisma.room.updateMany({
    where: { id: { in: booking.rooms.map(br => br.roomId) } },
    data:  { status: 'AVAILABLE' },
  });

  res.status(204).send();
});
