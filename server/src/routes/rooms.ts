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
  capacity: z.number().int().positive(),
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
  arrival:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis'),
  departure:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis'),
  excludeBookingId: z.string().optional(),
});

roomsRouter.get('/available', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = availabilitySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { arrival, departure, excludeBookingId } = parsed.data;
  const arrivalDate   = new Date(`${arrival}T00:00:00.000Z`);
  const departureDate = new Date(`${departure}T00:00:00.000Z`);

  if (departureDate <= arrivalDate) {
    res.status(400).json({ error: "La date de départ doit être après l'arrivée" });
    return;
  }

  const blocked = await prisma.bookingRoom.findMany({
    where: {
      arrival:   { lt: departureDate },
      departure: { gt: arrivalDate },
      booking: {
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        status: { notIn: ['CANCELLED', 'CHECKED_OUT'] },
      },
    },
    select: { roomId: true },
  });

  const blockedIds = new Set(blocked.map(br => br.roomId));

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

roomsRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, category, status } = req.query;

  const rooms = await prisma.room.findMany({
    where: {
      ...(search ? {
        OR: [
          { number: { contains: String(search), mode: 'insensitive' } },
          { type:   { contains: String(search), mode: 'insensitive' } },
        ],
      } : {}),
      ...(category && category !== 'ALL' ? { category: String(category).toUpperCase() as any } : {}),
      ...(status && status !== 'ALL' ? { status: String(status) as any } : {}),
    },
    include: { features: true },
    orderBy: { number: 'asc' },
  });

  res.json(rooms);
});

roomsRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const room = await prisma.room.findUnique({
    where: { id: req.params.id },
    include: {
      features: true,
      bookings: {
        include: {
          booking: {
            include: { guest: { select: { id: true, name: true, email: true, avatar: true } } },
          },
        },
        orderBy: { arrival: 'desc' },
        take: 10,
      },
    },
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

  // Si passage en maintenance, renvoyer les réservations actives/futures impactées
  if (data.status === 'MAINTENANCE') {
    const conflicts = await prisma.booking.findMany({
      where: {
        rooms:      { some: { roomId: room.id } },
        status:     { notIn: ['CANCELLED', 'CHECKED_OUT'] },
        departure:  { gte: new Date() },
      },
      select: {
        id:       true,
        arrival:  true,
        departure: true,
        guest:    { select: { name: true } },
      },
      orderBy: { arrival: 'asc' },
    });
    res.json({ ...room, conflicts });
    return;
  }

  res.json(room);
});

roomsRouter.delete('/:id', authorize('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.room.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
