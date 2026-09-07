import { z } from 'zod';
import { UserStatus } from '@prisma/client';

export const staffSchema = z.object({
  username: z.string().min(3).regex(/^[a-z0-9._-]+$/i, 'Lettres, chiffres, points, tirets uniquement'),
  email: z.string().email().optional(),
  password: z.string().min(8),
  name: z.string().min(1),
  roleId: z.string().min(1),
  status: z.nativeEnum(UserStatus).optional(),
  avatar: z.string().optional(),
});

export const staffUpdateSchema = staffSchema.omit({ password: true }).partial();

export type StaffInput = z.infer<typeof staffSchema>;
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;
