import { z } from 'zod';
import { GuestStatus } from '@prisma/client';

export const guestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  status: z.nativeEnum(GuestStatus).optional(),
  avatar: z.string().optional(),
  preferences: z.array(z.string()).optional(),
});

export const noteSchema = z.object({
  content: z.string().min(1),
});

export const guestPaginationSchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(GuestStatus).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
});

export type GuestInput = z.infer<typeof guestSchema>;
export type GuestPaginationParams = z.infer<typeof guestPaginationSchema>;
