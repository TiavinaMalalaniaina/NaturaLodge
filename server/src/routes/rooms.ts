import { Router, Response } from 'express';
import { z } from 'zod';
import { RoomCategory, RoomStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

export const roomsRouter = Router();
roomsRouter.use(authenticate);

const roomSchema = z.object({
  number: z.string().min(1),
  type: z.string().min(1),
  category: z.nativeEnum(RoomCategory),
  area: z.number().int().positive(),
  bedType: z.string().min(1),
  capacity: z.string().min(1),
  rate: z.number().int().positive(),
  status: z.nativeEnum(RoomStatus).optional(),
  view: z.string().optional(),
  images: z.array(z.string()).optional(),
  description: z.string().optional(),
  featureIds: z.array(z.string()).optional(),
});

// ─── Features ────────────────────────────────────────────────────
roomsRouter.get('/features', async (_req: AuthRequest, res: Response): Promise<void> => {
  const features = await prisma.roomFeature.findMany({ orderBy: { label: 'asc' } });
  res.json(features);
});

roomsRouter.post('/features', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ label: z.string().min(1), iconName: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const feature = await prisma.roomFeature.create({ data: parsed.data });
  res.status(201).json(feature);
});

roomsRouter.delete('/features/:featureId', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.roomFeature.delete({ where: { id: req.params.featureId } });
  res.status(204).send();
});

// ─── Available rooms for a date range ────────────────────────────

const availabilitySchema = z.object({
  arrival:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis'),
  departure: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis'),
  excludeBookingId: z.string().optional(), // utile pour le réassignement
});

roomsRouter.get('/available', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = availabilitySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { arrival, departure, excludeBookingId } = parsed.data;
  const arrivalDate   = new Date(`${arrival}T00:00:00.000Z`);
  const departureDate = new Date(`${departure}T00:00:00.000Z`);

  if (departureDate <= arrivalDate) {
    res.status(400).json({ error: 'La date de départ doit être après l\'arrivée' });
    return;
  }

  // Trouve les chambres qui ont au moins une réservation qui chevauche la période
  const conflictingBookings = await prisma.booking.findMany({
    where: {
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      status:    { notIn: ['CANCELLED', 'CHECKED_OUT'] },
      arrival:   { lt: departureDate },  // commence avant la fin demandée
      departure: { gt: arrivalDate },    // finit après le début demandé
    },
    select: { roomId: true },
  });

  const blockedIds = new Set(conflictingBookings.map(b => b.roomId));

  const rooms = await prisma.room.findMany({
    where: {
      status: { not: 'MAINTENANCE' },
      id:     { notIn: [...blockedIds] },
    },
    include: { features: true },
    orderBy: { rate: 'asc' },
  });

  res.json(rooms);
});

// ─── Rooms ───────────────────────────────────────────────────────

/** Calcule le statut en temps réel depuis les réservations actives. */
async function computeRoomStatuses(roomIds: string[]): Promise<Map<string, RoomStatus>> {
  const now = new Date();

  const [active, upcoming] = await Promise.all([
    // Réservations dont la période couvre aujourd'hui
    prisma.booking.findMany({
      where: {
        roomId: { in: roomIds },
        status: { notIn: ['CANCELLED', 'CHECKED_OUT'] },
        arrival:   { lte: now },
        departure: { gte: now },
      },
      select: { roomId: true },
    }),
    // Réservations futures confirmées
    prisma.booking.findMany({
      where: {
        roomId: { in: roomIds },
        status: { notIn: ['CANCELLED', 'CHECKED_OUT'] },
        arrival: { gt: now },
      },
      select: { roomId: true },
    }),
  ]);

  const occupiedIds  = new Set(active.map(b => b.roomId));
  const reservedIds  = new Set(upcoming.map(b => b.roomId));
  const result       = new Map<string, RoomStatus>();

  for (const id of roomIds) {
    if (occupiedIds.has(id))  result.set(id, 'OCCUPIED');
    else if (reservedIds.has(id)) result.set(id, 'RESERVED');
    else result.set(id, 'AVAILABLE');
  }
  return result;
}

roomsRouter.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const rooms = await prisma.room.findMany({
    include: { features: true },
    orderBy: { number: 'asc' },
  });

  const ids = rooms.map(r => r.id);
  const computed = await computeRoomStatuses(ids);

  const result = rooms.map(r => ({
    ...r,
    // MAINTENANCE est intentionnel → on le garde ; sinon statut calculé
    status: r.status === 'MAINTENANCE' ? r.status : (computed.get(r.id) ?? r.status),
  }));

  res.json(result);
});

roomsRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const room = await prisma.room.findUnique({
    where: { id: req.params.id },
    include: { features: true, bookings: { include: { guest: true }, orderBy: { arrival: 'desc' }, take: 10 } },
  });
  if (!room) { res.status(404).json({ error: 'Chambre introuvable' }); return; }
  res.json(room);
});

roomsRouter.post('/', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = roomSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { featureIds, ...data } = parsed.data;
  const room = await prisma.room.create({
    data: {
      ...data,
      features: featureIds ? { connect: featureIds.map(id => ({ id })) } : undefined,
    },
    include: { features: true },
  });
  res.status(201).json(room);
});

roomsRouter.patch('/:id', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = roomSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { featureIds, ...data } = parsed.data;
  const room = await prisma.room.update({
    where: { id: req.params.id },
    data: {
      ...data,
      features: featureIds ? { set: featureIds.map(id => ({ id })) } : undefined,
    },
    include: { features: true },
  });
  res.json(room);
});

roomsRouter.delete('/:id', authorize('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.room.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
