import { z } from 'zod';
import { BookingStatus } from '@prisma/client';

// Statuts qu'un appelant peut demander explicitement. CHECKED_OUT_UNPAID/CHECKED_OUT_PAID/CLOSED
// ne sont jamais acceptés en entrée — 'CHECKED_OUT' est résolu côté service vers l'un des deux
// selon le paiement, et CLOSED passe uniquement par PATCH /:id/close (voir booking.service.ts).
const requestedBookingStatusSchema = z.enum(['CONFIRMED', 'CHECKED_IN', 'AWAITING', 'CANCELLED', 'CHECKED_OUT']);

export const roomEntryExtraSchema = z.object({
  extraId:  z.string().min(1),
  quantity: z.number().int().positive().default(1),
});

export const roomEntrySchema = z.object({
  roomId:   z.string().min(1),
  roomRate: z.number().int().positive(),
  arrival:  z.string().datetime().optional(),
  departure: z.string().datetime().optional(),
  extras:   z.array(roomEntryExtraSchema).optional(),
});

export const bookingSchema = z.object({
  guestId:     z.string().min(1),
  arrival:     z.string().datetime(),
  departure:   z.string().datetime(),
  rooms:       z.array(roomEntrySchema).min(1),
  status:      requestedBookingStatusSchema.optional(),
  totalAmount: z.number().int().positive(),
  notes:       z.string().optional(),
});

export const bookingListSchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(500).default(20),
  status:    z.nativeEnum(BookingStatus).optional(),
  date:      z.string().optional(),
  startDate: z.string().optional(),
  endDate:   z.string().optional(),
  search:    z.string().optional(),
  sort:      z.enum(['arrival', 'departure', 'createdAt', 'totalAmount']).default('arrival'),
  order:     z.enum(['asc', 'desc']).default('asc'),
});

export const bookingStatusSchema = z.object({
  status: requestedBookingStatusSchema,
  // Uniquement pris en compte quand status === 'CANCELLED' : taux de remboursement appliqué aux
  // factures visées de la réservation (défaut côté service : DEFAULT_CANCELLATION_REFUND_RATE).
  refundRatePercent: z.number().int().min(0).max(100).optional(),
});

export const reassignSchema = z.object({
  oldRoomId: z.string().min(1),
  newRoomId: z.string().min(1),
  arrival:   z.string().datetime().optional(),
  departure: z.string().datetime().optional(),
  roomRate:  z.number().int().positive().optional(),
});

export const addBookingRoomSchema = z.object({
  roomId:    z.string().min(1),
  arrival:   z.string().datetime().optional(),
  departure: z.string().datetime().optional(),
  roomRate:  z.number().int().positive().optional(),
});

export const addBookingRoomExtraSchema = z.object({
  extraId:  z.string().min(1),
  quantity: z.number().int().positive().default(1),
});

export const updateBookingRoomExtraSchema = z.object({
  quantity: z.number().int().positive(),
});

export const bookingNoteSchema = z.object({
  content: z.string().min(1),
});

export type BookingInput = z.infer<typeof bookingSchema>;
export type BookingListParams = z.infer<typeof bookingListSchema>;
export type ReassignInput = z.infer<typeof reassignSchema>;
export type AddBookingRoomInput = z.infer<typeof addBookingRoomSchema>;
export type AddBookingRoomExtraInput = z.infer<typeof addBookingRoomExtraSchema>;
export type UpdateBookingRoomExtraInput = z.infer<typeof updateBookingRoomExtraSchema>;
export type BookingNoteInput = z.infer<typeof bookingNoteSchema>;
