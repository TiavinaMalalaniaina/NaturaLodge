import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { can } from '../middleware/can';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  bookingSchema, bookingListSchema, bookingStatusSchema, reassignSchema, addBookingRoomSchema,
  addBookingRoomExtraSchema, updateBookingRoomExtraSchema,
  bookingNoteSchema,
} from '../validation/booking.schema';
import * as bookingService from '../services/booking.service';

export const bookingsRouter = Router();
bookingsRouter.use(authenticate);

bookingsRouter.get('/', can('bookings.view'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = bookingListSchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await bookingService.list(parsed.data));
}));

bookingsRouter.get('/:id', can('bookings.view'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await bookingService.getById(req.params.id));
}));

bookingsRouter.post('/', can('bookings.create'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await bookingService.create(parsed.data, req.user!.id));
}));

bookingsRouter.patch('/:id/status', can('bookings.update_status'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = bookingStatusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await bookingService.updateStatus(req.params.id, parsed.data.status, req.user!.id));
}));

// PATCH /bookings/:id/reassign  ── remplacer la chambre et/ou les dates d'une ligne de réservation
bookingsRouter.patch('/:id/reassign', can('bookings.reassign'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = reassignSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await bookingService.reassign(req.params.id, parsed.data));
}));

// POST /bookings/:id/rooms  ── ajouter une chambre à une réservation existante
bookingsRouter.post('/:id/rooms', can('bookings.manage_rooms'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = addBookingRoomSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await bookingService.addRoom(req.params.id, parsed.data));
}));

// DELETE /bookings/:id/rooms/:roomId  ── retirer une chambre d'une réservation
bookingsRouter.delete('/:id/rooms/:roomId', can('bookings.manage_rooms'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await bookingService.removeRoom(req.params.id, req.params.roomId));
}));

// POST /bookings/:id/rooms/:roomId/extras  ── ajouter un supplément à une chambre de la réservation
bookingsRouter.post('/:id/rooms/:roomId/extras', can('bookings.manage_rooms'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = addBookingRoomExtraSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await bookingService.addExtraToRoom(req.params.id, req.params.roomId, parsed.data));
}));

// PATCH /bookings/:id/rooms/:roomId/extras/:extraId  ── modifier la quantité d'un supplément
bookingsRouter.patch('/:id/rooms/:roomId/extras/:extraId', can('bookings.manage_rooms'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateBookingRoomExtraSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await bookingService.updateExtraQuantity(req.params.id, req.params.roomId, req.params.extraId, parsed.data));
}));

// DELETE /bookings/:id/rooms/:roomId/extras/:extraId  ── retirer un supplément d'une chambre
bookingsRouter.delete('/:id/rooms/:roomId/extras/:extraId', can('bookings.manage_rooms'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await bookingService.removeExtraFromRoom(req.params.id, req.params.roomId, req.params.extraId));
}));

bookingsRouter.delete('/:id', can('bookings.delete'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  await bookingService.remove(req.params.id);
  res.status(204).send();
}));


// ─── Notes ───────────────────────────────────────────────────────
bookingsRouter.post('/:id/notes', can('bookings.add_note'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = bookingNoteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await bookingService.addBookingNote(req.params.id, parsed.data.content, req.user!.id));
}));

bookingsRouter.delete('/:id/notes/:noteId', can('bookings.delete_note'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  await bookingService.removeBookingNote(req.params.id, req.params.noteId);
  res.status(204).send();
}));
