import { Router, Response } from 'express';
import { z } from 'zod';
import { AmenityStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

export const amenitiesRouter = Router();
amenitiesRouter.use(authenticate);

const amenitySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  iconName: z.string().optional(),
  status: z.nativeEnum(AmenityStatus).optional(),
});

amenitiesRouter.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const amenities = await prisma.amenity.findMany({ orderBy: { name: 'asc' } });
  res.json(amenities);
});

amenitiesRouter.post('/', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = amenitySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const amenity = await prisma.amenity.create({ data: parsed.data });
  res.status(201).json(amenity);
});

amenitiesRouter.patch('/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = amenitySchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const amenity = await prisma.amenity.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(amenity);
});

amenitiesRouter.delete('/:id', authorize('ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.amenity.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
