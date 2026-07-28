import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

export const roomTypesRouter = Router();
roomTypesRouter.use(authenticate);

const roomTypeSchema = z.object({
  name:        z.string().min(1),
  rate:        z.number().int().positive(),
  description: z.string().optional().default(''),
  area:        z.number().int().positive().optional().default(30),
  bedType:     z.string().optional().default('King Size'),
  capacity:    z.number().int().min(1).max(20).optional().default(2),
  view:        z.string().optional().default('Garden View'),
  featureIds:  z.array(z.string()).optional(),
});

const include = {
  features: true,
  rooms:    { select: { id: true }, orderBy: { number: 'asc' as const } },
};

roomTypesRouter.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const types = await prisma.roomType.findMany({
    include,
    orderBy: { name: 'asc' },
  });
  res.json(types);
});

roomTypesRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const rt = await prisma.roomType.findUnique({ where: { id: req.params.id }, include });
  if (!rt) { res.status(404).json({ error: 'Type introuvable' }); return; }
  res.json(rt);
});

roomTypesRouter.post('/', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = roomTypeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { featureIds, ...data } = parsed.data;
  const rt = await prisma.roomType.create({
    data: {
      ...data,
      features: featureIds ? { connect: featureIds.map(id => ({ id })) } : undefined,
    },
    include,
  });
  res.status(201).json(rt);
});

roomTypesRouter.patch('/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = roomTypeSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { featureIds, ...data } = parsed.data;
  const rt = await prisma.roomType.update({
    where: { id: req.params.id },
    data: {
      ...data,
      features: featureIds ? { set: featureIds.map(id => ({ id })) } : undefined,
    },
    include,
  });
  res.json(rt);
});

roomTypesRouter.delete('/:id', authorize('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const count = await prisma.room.count({ where: { roomTypeId: req.params.id } });
  if (count > 0) {
    res.status(409).json({ error: `Impossible de supprimer : ${count} chambre(s) utilisent ce type.` });
    return;
  }
  await prisma.roomType.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
