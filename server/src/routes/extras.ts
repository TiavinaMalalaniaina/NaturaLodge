import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { can } from '../middleware/can';
import { asyncHandler } from '../middleware/asyncHandler';
import { extraSchema } from '../validation/extra.schema';
import * as extraService from '../services/extra.service';

export const extrasRouter = Router();
extrasRouter.use(authenticate);

extrasRouter.get('/', can('extras.view'), asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await extraService.list());
}));

extrasRouter.get('/:id', can('extras.view'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await extraService.getById(req.params.id));
}));

extrasRouter.post('/', can('extras.manage'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = extraSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await extraService.create(parsed.data));
}));

extrasRouter.patch('/:id', can('extras.manage'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = extraSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await extraService.update(req.params.id, parsed.data));
}));

extrasRouter.delete('/:id', can('extras.manage'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  await extraService.remove(req.params.id);
  res.status(204).send();
}));
