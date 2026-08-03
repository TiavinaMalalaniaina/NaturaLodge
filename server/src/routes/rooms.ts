import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { roomSchema, roomFeatureSchema } from '../validation/room.schema';
import * as roomService from '../services/room.service';

export const roomsRouter = Router();
roomsRouter.use(authenticate);

// ─── Features ─────────────────────────────────────────────────────

roomsRouter.get('/features', asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await roomService.listFeatures());
}));

roomsRouter.post('/features', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = roomFeatureSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await roomService.createFeature(parsed.data));
}));

roomsRouter.delete('/features/:id', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  await roomService.removeFeature(req.params.id);
  res.status(204).send();
}));

// ─── Available rooms ─────────────────────────────────────────────

roomsRouter.get('/available', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { arrival, departure, excludeBookingId } = req.query;
  if (!arrival || !departure) { res.status(400).json({ error: 'arrival et departure requis' }); return; }

  const arr = new Date(String(arrival));
  const dep = new Date(String(departure));
  if (dep <= arr) { res.status(400).json({ error: "La date de départ doit être après l'arrivée" }); return; }

  res.json(await roomService.listAvailable(arr, dep, excludeBookingId ? String(excludeBookingId) : undefined));
}));

// ─── Rooms CRUD ───────────────────────────────────────────────────

roomsRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, status } = req.query;
  res.json(await roomService.list(search ? String(search) : undefined, status ? String(status) : undefined));
}));

roomsRouter.get('/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await roomService.getById(req.params.id));
}));

roomsRouter.post('/', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = roomSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await roomService.create(parsed.data));
}));

roomsRouter.patch('/:id', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = roomSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await roomService.update(req.params.id, parsed.data));
}));

roomsRouter.delete('/:id', authorize('ADMIN'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  await roomService.remove(req.params.id);
  res.status(204).send();
}));
