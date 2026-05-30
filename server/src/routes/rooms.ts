import { Router, Response } from 'express';
import { z } from 'zod';
import { RoomCategory, RoomStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { applyRoomStatuses } from '../lib/roomStatus';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

export const roomsRouter = Router();
roomsRouter.use(authenticate);

// ─── Shared include ───────────────────────────────────────────────

const roomInclude = {
  roomType: { include: { features: true } },
} as const;

// ─── Schema ───────────────────────────────────────────────────────

const roomSchema = z.object({
  number:      z.string().min(1),
  roomTypeId:  z.string().min(1),
  images:      z.array(z.string()).optional(),
  rateOverride: z.number().int().positive().nullable().optional(),
  status:      z.nativeEnum(RoomStatus).optional(),
});

// ─── Available rooms ─────────────────────────────────────────────

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

roomsRouter.delete('/features/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.roomFeature.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

roomsRouter.get('/available', async (req: AuthRequest, res: Response): Promise<void> => {
  const { arrival, departure, excludeBookingId } = req.query;
  if (!arrival || !departure) { res.status(400).json({ error: 'arrival et departure requis' }); return; }

  const arr = new Date(String(arrival));
  const dep = new Date(String(departure));
  if (dep <= arr) { res.status(400).json({ error: "La date de départ doit être après l'arrivée" }); return; }

  const rooms = await prisma.room.findMany({
    where: {
      status: { not: 'MAINTENANCE' },
      bookings: {
        none: {
          arrival:  { lt: dep },
          departure: { gt: arr },
          booking:  {
            status: { notIn: ['CANCELLED', 'CHECKED_OUT'] },
            ...(excludeBookingId ? { id: { not: String(excludeBookingId) } } : {}),
          },
        },
      },
    },
    include: roomInclude,
    orderBy: { number: 'asc' },
  });

  res.json(rooms.map(flattenRoom));
});

// ─── Rooms CRUD ───────────────────────────────────────────────────

function flattenRoom(r: any) {
  const rt = r.roomType;
  return {
    id:           r.id,
    number:       r.number,
    status:       r.status,
    images:       r.images,
    rateOverride: r.rateOverride ?? null,
    roomTypeId:   r.roomTypeId,
    createdAt:    r.createdAt,
    // Flattened from RoomType
    type:         rt.name,
    category:     rt.category,
    rate:         r.rateOverride ?? rt.rate,
    description:  rt.description,
    area:         rt.area,
    bedType:      rt.bedType,
    capacity:     rt.capacity,
    view:         rt.view,
    features:     rt.features,
  };
}

roomsRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, category, status } = req.query;

  const rooms = await prisma.room.findMany({
    where: {
      ...(search ? {
        OR: [
          { number:   { contains: String(search), mode: 'insensitive' } },
          { roomType: { name: { contains: String(search), mode: 'insensitive' } } },
        ],
      } : {}),
      ...(category && category !== 'ALL' ? { roomType: { category: String(category).toUpperCase() as RoomCategory } } : {}),
      ...(status && status !== 'ALL' ? { status: String(status) as RoomStatus } : {}),
    },
    include: roomInclude,
    orderBy: { number: 'asc' },
  });

  res.json(rooms.map(flattenRoom));
});

roomsRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const room = await prisma.room.findUnique({
    where: { id: req.params.id },
    include: {
      roomType: { include: { features: true } },
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
  res.json({ ...flattenRoom(room), bookings: room.bookings });
});

roomsRouter.post('/', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = roomSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const room = await prisma.room.create({
    data: {
      number:       parsed.data.number,
      roomTypeId:   parsed.data.roomTypeId,
      images:       parsed.data.images ?? [],
      rateOverride: parsed.data.rateOverride ?? null,
    },
    include: roomInclude,
  });
  res.status(201).json(flattenRoom(room));
});

roomsRouter.patch('/:id', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = roomSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const room = await prisma.room.update({
    where: { id: req.params.id },
    data: {
      ...(parsed.data.number      !== undefined && { number:       parsed.data.number }),
      ...(parsed.data.roomTypeId  !== undefined && { roomTypeId:   parsed.data.roomTypeId }),
      ...(parsed.data.images      !== undefined && { images:       parsed.data.images }),
      ...(parsed.data.rateOverride !== undefined && { rateOverride: parsed.data.rateOverride }),
      ...(parsed.data.status      !== undefined && { status:       parsed.data.status }),
    },
    include: roomInclude,
  });

  // Si passage en maintenance, renvoyer les réservations actives/futures impactées
  if (parsed.data.status === 'MAINTENANCE') {
    const conflicts = await prisma.booking.findMany({
      where: {
        rooms:     { some: { roomId: room.id } },
        status:    { notIn: ['CANCELLED', 'CHECKED_OUT'] },
        departure: { gte: new Date() },
      },
      select: {
        id:       true,
        arrival:  true,
        departure: true,
        guest:    { select: { name: true } },
      },
      orderBy: { arrival: 'asc' },
    });
    res.json({ ...flattenRoom(room), conflicts });
    return;
  }

  // Si passage hors maintenance (AVAILABLE), recalculer le vrai statut
  if (parsed.data.status === 'AVAILABLE') {
    await applyRoomStatuses([room.id]);
    const refreshed = await prisma.room.findUnique({ where: { id: room.id }, include: roomInclude });
    res.json(flattenRoom(refreshed!));
    return;
  }

  res.json(flattenRoom(room));
});

roomsRouter.delete('/:id', authorize('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.room.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
