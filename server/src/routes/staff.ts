import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

export const staffRouter = Router();
staffRouter.use(authenticate);

const staffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  avatar: z.string().optional(),
});

const select = {
  id: true, email: true, name: true, role: true,
  status: true, avatar: true, joinedDate: true, lastLogin: true,
};

staffRouter.get('/', authorize('ADMIN', 'MANAGER'), async (_req: AuthRequest, res: Response): Promise<void> => {
  const staff = await prisma.user.findMany({ select, orderBy: { name: 'asc' } });
  res.json(staff);
});

staffRouter.get('/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const member = await prisma.user.findUnique({ where: { id: req.params.id }, select });
  if (!member) { res.status(404).json({ error: 'Membre introuvable' }); return; }
  res.json(member);
});

staffRouter.post('/', authorize('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = staffSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const hashed = await bcrypt.hash(parsed.data.password, 12);
  try {
    const member = await prisma.user.create({
      data: { ...parsed.data, password: hashed },
      select,
    });
    res.status(201).json(member);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
      return;
    }
    throw err;
  }
});

staffRouter.patch('/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = staffSchema.omit({ password: true }).partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const member = await prisma.user.update({
    where: { id: req.params.id },
    data: parsed.data,
    select,
  });
  res.json(member);
});

staffRouter.patch('/:id/password', authorize('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ password: z.string().min(8) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const hashed = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed } });
  res.json({ success: true });
});

staffRouter.delete('/:id', authorize('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.params.id === req.user!.id) {
    res.status(400).json({ error: 'Impossible de supprimer son propre compte' });
    return;
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
