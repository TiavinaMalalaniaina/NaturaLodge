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
  author: z.string().min(1),
  role: z.string().min(1),
  content: z.string().min(1),
});

guestsRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, status } = req.query;
  const guests = await prisma.guest.findMany({
    where: {
      ...(search ? {
        OR: [
          { name: { contains: String(search), mode: 'insensitive' } },
          { email: { contains: String(search), mode: 'insensitive' } },
        ],
      } : {}),
      ...(status ? { status: status as GuestStatus } : {}),
    },
    include: { notes: { orderBy: { createdAt: 'desc' } } },
    orderBy: { name: 'asc' },
  });
  res.json(guests);
});

guestsRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const guest = await prisma.guest.findUnique({
    where: { id: req.params.id },
    include: {
      notes: { orderBy: { createdAt: 'desc' } },
      bookings: { include: { room: true }, orderBy: { arrival: 'desc' } },
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
    include: { notes: true },
  });
  res.status(201).json(guest);
});

guestsRouter.patch('/:id', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = guestSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const guest = await prisma.guest.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: { notes: true },
  });
  res.json(guest);
});

guestsRouter.delete('/:id', authorize('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.guest.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// Notes
guestsRouter.post('/:id/notes', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const note = await prisma.guestNote.create({
    data: { ...parsed.data, guestId: req.params.id },
  });
  res.status(201).json(note);
});

guestsRouter.delete('/:id/notes/:noteId', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.guestNote.delete({ where: { id: req.params.noteId } });
  res.status(204).send();
});
