import { Router, Response } from 'express';
import { z } from 'zod';
import { GuestStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

export const guestsRouter = Router();
guestsRouter.use(authenticate);

const guestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  status: z.nativeEnum(GuestStatus).optional(),
  avatar: z.string().optional(),
  preferences: z.array(z.string()).optional(),
});

const noteSchema = z.object({
  content: z.string().min(1),
});

const notesInclude = {
  notes: {
    include: { author: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
};

const paginationSchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(GuestStatus).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
});

guestsRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { search, status, page, limit } = parsed.data;
  const skip = (page - 1) * limit;

  const where = {
    ...(search ? {
      OR: [
        { name:  { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
    ...(status ? { status } : {}),
  };

  const [guests, total] = await Promise.all([
    prisma.guest.findMany({ where, include: notesInclude, orderBy: { name: 'asc' }, skip, take: limit }),
    prisma.guest.count({ where }),
  ]);

  res.json({
    data: guests,
    meta: {
      total, page, limit,
      totalPages:  Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
});

guestsRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const guest = await prisma.guest.findUnique({
    where: { id: req.params.id },
    include: {
      ...notesInclude,
      bookings: {
        include: {
          rooms: { include: { room: { select: { id: true, number: true, type: true, category: true } } } },
        },
        orderBy: { arrival: 'desc' },
      },
    },
  });
  if (!guest) { res.status(404).json({ error: 'Client introuvable' }); return; }
  res.json(guest);
});

guestsRouter.post('/', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = guestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const guest = await prisma.guest.create({
    data: { ...parsed.data, preferences: parsed.data.preferences ?? [] },
    include: notesInclude,
  });
  res.status(201).json(guest);
});

guestsRouter.patch('/:id', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = guestSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const guest = await prisma.guest.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: notesInclude,
  });
  res.json(guest);
});

guestsRouter.delete('/:id', authorize('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.guest.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Notes ───────────────────────────────────────────────────────

guestsRouter.post('/:id/notes', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const note = await prisma.guestNote.create({
    data: { content: parsed.data.content, guestId: req.params.id, authorId: req.user!.id },
    include: { author: { select: { id: true, name: true, role: true } } },
  });
  res.status(201).json(note);
});

guestsRouter.delete('/:id/notes/:noteId', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.guestNote.delete({ where: { id: req.params.noteId } });
  res.status(204).send();
});
