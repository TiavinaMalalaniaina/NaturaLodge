import { z } from 'zod';

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token de réinitialisation requis'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
