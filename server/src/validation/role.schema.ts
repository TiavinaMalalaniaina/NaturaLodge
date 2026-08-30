import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z.string().min(1).max(40),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(40),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
