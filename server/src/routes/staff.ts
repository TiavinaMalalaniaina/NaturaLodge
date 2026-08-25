import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { can } from '../middleware/can';
import { asyncHandler } from '../middleware/asyncHandler';
import { staffSchema, staffUpdateSchema } from '../validation/staff.schema';
import * as staffService from '../services/staff.service';

export const staffRouter = Router();
staffRouter.use(authenticate);

staffRouter.get('/', can('staff.view'), asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await staffService.list());
}));

staffRouter.get('/:id', can('staff.view'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await staffService.getById(req.params.id));
}));

staffRouter.post('/', can('staff.create'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = staffSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await staffService.create(parsed.data));
}));

staffRouter.patch('/:id', can('staff.update'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = staffUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await staffService.update(req.params.id, parsed.data, req.user!.role));
}));

staffRouter.patch('/:id/password', can('staff.manage_password'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ password: z.string().min(8) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  await staffService.updatePassword(req.params.id, parsed.data.password);
  res.json({ success: true });
}));

staffRouter.delete('/:id', can('staff.delete'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  await staffService.remove(req.params.id, req.user!.id);
  res.status(204).send();
}));
