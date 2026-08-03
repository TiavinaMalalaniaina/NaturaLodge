import { z } from 'zod';
import { Role, UserStatus } from '@prisma/client';

export const staffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  avatar: z.string().optional(),
});

export const staffUpdateSchema = staffSchema.omit({ password: true }).partial();

export type StaffInput = z.infer<typeof staffSchema>;
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;
