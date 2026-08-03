import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { roomTypeSchema } from '../validation/roomType.schema';
import * as roomTypeService from '../services/roomType.service';

export const roomTypesRouter = Router();
roomTypesRouter.use(authenticate);

roomTypesRouter.get('/', asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await roomTypeService.list());
}));

roomTypesRouter.get('/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await roomTypeService.getById(req.params.id));
}));

roomTypesRouter.post('/', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = roomTypeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await roomTypeService.create(parsed.data));
}));

roomTypesRouter.patch('/:id', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = roomTypeSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await roomTypeService.update(req.params.id, parsed.data));
}));

roomTypesRouter.delete('/:id', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  await roomTypeService.remove(req.params.id);
  res.status(204).send();
}));
