import { Router, Response } from 'express';
import { z } from 'zod';
import { BookingStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

export const bookingsRouter = Router();
bookingsRouter.use(authenticate);

const bookingSchema = z.object({
  guestId: z.string().min(1),
  roomId: z.string().min(1),
  arrival: z.string().datetime(),
  departure: z.string().datetime(),
  status: z.nativeEnum(BookingStatus).optional(),
  totalAmount: z.number().int().positive(),
  notes: z.string().optional(),
});

const include = {
  guest: { select: { id: true, name: true, email: true, avatar: true, status: true } },
  room: { select: { id: true, number: true, type: true, category: true, rate: true } },
};

export type EffectiveStatus =
  | 'upcoming'      // réservé, arrivée dans le futur
  | 'due_checkin'   // arrivée prévue aujourd'hui, pas encore checké
  | 'in_progress'   // séjour en cours (checked-in)
  | 'overdue'       // départ dépassé, pas encore checked-out
  | 'checked_in'    // dans les murs
  | 'checked_out'
  | 'cancelled';

function computeEffectiveStatus(b: { arrival: Date; departure: Date; status: BookingStatus }): EffectiveStatus {
  const now = new Date();
  if (b.status === 'CANCELLED')    return 'cancelled';
  if (b.status === 'CHECKED_OUT')  return 'checked_out';
  if (b.status === 'CHECKED_IN') {
    if (now > b.departure) return 'overdue';
    return 'in_progress';
  }
  // CONFIRMED / AWAITING
  if (now < b.arrival) {
    const sameDay = b.arrival.toDateString() === now.toDateString();
    return sameDay ? 'due_checkin' : 'upcoming';
  }
  if (now >= b.arrival && now <= b.departure) return 'due_checkin';
  return 'overdue'; // parti sans checkout
}

const paginationSchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(500).default(20),
  status:    z.nativeEnum(BookingStatus).optional(),
  date:      z.string().optional(),
  startDate: z.string().optional(), // range : debut (ex: planning grid)
  endDate:   z.string().optional(), // range : fin
  search:    z.string().optional(),
  sort:      z.enum(['arrival', 'departure', 'createdAt', 'totalAmount']).default('arrival'),
  order:     z.enum(['asc', 'desc']).default('asc'),
});

bookingsRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { page, limit, status, date, startDate, endDate, search, sort, order } = parsed.data;
  const skip = (page - 1) * limit;

  const where = {
    ...(status ? { status } : {}),
    // Filtre par plage (planning grid) : chevauchement avec [startDate, endDate[
    ...(startDate && endDate ? {
      arrival:   { lt: new Date(endDate) },
      departure: { gt: new Date(startDate) },
    } : date ? {
      // Filtre par date unique : le séjour couvre cette date
      arrival:   { lte: new Date(date) },
      departure: { gte: new Date(date) },
    } : {}),
    ...(search ? {
      OR: [
        { guest: { name: { contains: search, mode: 'insensitive' as const } } },
        { room: { number: { contains: search, mode: 'insensitive' as const } } },
      ],
    } : {}),
  };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include,
      orderBy: { [sort]: order },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  const enriched = bookings.map(b => ({
    ...b,
    nights: Math.max(1, Math.round(
      (b.departure.getTime() - b.arrival.getTime()) / 86_400_000
    )),
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
  res.json(booking);
});

bookingsRouter.post('/', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const arrival = new Date(parsed.data.arrival);
  const departure = new Date(parsed.data.departure);

  // Vérifier la disponibilité de la chambre
  const conflict = await prisma.booking.findFirst({
    where: {
      roomId: parsed.data.roomId,
      status: { notIn: ['CANCELLED', 'CHECKED_OUT'] },
      AND: [{ arrival: { lt: departure } }, { departure: { gt: arrival } }],
    },
  });
  if (conflict) {
    res.status(409).json({ error: 'La chambre est déjà réservée sur cette période' });
    return;
  }

  const booking = await prisma.booking.create({
    data: { ...parsed.data, arrival, departure },
    include,
  });

  // Mettre à jour le statut de la chambre
  await prisma.room.update({ where: { id: parsed.data.roomId }, data: { status: 'RESERVED' } });

  res.status(201).json(booking);
});

bookingsRouter.patch('/:id/status', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ status: z.nativeEnum(BookingStatus) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const booking = await prisma.booking.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status },
    include,
  });

  // Synchroniser le statut de la chambre
  const roomStatus = {
    CHECKED_IN: 'OCCUPIED' as const,
    CHECKED_OUT: 'AVAILABLE' as const,
    CANCELLED: 'AVAILABLE' as const,
    CONFIRMED: 'RESERVED' as const,
    AWAITING: 'RESERVED' as const,
  };
  await prisma.room.update({
    where: { id: booking.roomId },
    data: { status: roomStatus[parsed.data.status] },
  });

  // Incrémenter totalStays du client au check-out
  if (parsed.data.status === 'CHECKED_OUT') {
    await prisma.guest.update({
      where: { id: booking.guestId },
      data: { totalStays: { increment: 1 }, lifetimeValue: { increment: booking.totalAmount } },
    });
  }

  res.json(booking);
});

bookingsRouter.delete('/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) { res.status(404).json({ error: 'Réservation introuvable' }); return; }

  await prisma.booking.delete({ where: { id: req.params.id } });
  await prisma.room.update({ where: { id: booking.roomId }, data: { status: 'AVAILABLE' } });
  res.status(204).send();
});
