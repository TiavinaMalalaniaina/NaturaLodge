import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { guestSchema, noteSchema, guestPaginationSchema } from '../validation/guest.schema';
import * as guestService from '../services/guest.service';

export const guestsRouter = Router();
guestsRouter.use(authenticate);

guestsRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = guestPaginationSchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await guestService.list(parsed.data));
}));

guestsRouter.get('/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await guestService.getById(req.params.id));
}));

guestsRouter.post('/', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = guestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await guestService.create(parsed.data));
}));

guestsRouter.patch('/:id', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = guestSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await guestService.update(req.params.id, parsed.data));
}));

guestsRouter.delete('/:id', authorize('ADMIN'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  await guestService.remove(req.params.id);
  res.status(204).send();
}));

// ─── Notes ───────────────────────────────────────────────────────

guestsRouter.post('/:id/notes', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await guestService.addNote(req.params.id, parsed.data.content, req.user!.id));
}));

guestsRouter.delete('/:id/notes/:noteId', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  await guestService.removeNote(req.params.id, req.params.noteId);
  res.status(204).send();
}));
