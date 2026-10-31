import { z } from 'zod';

// Validation schema for resetting password
export const resetPasswordSchema = z.object({
  token: z.string().uuid('Token de réinitialisation invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
