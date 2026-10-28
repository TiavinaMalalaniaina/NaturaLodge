import { z } from 'zod';

// Schéma Zod côté client, volontairement distinct de server/src/validation/staff.schema.ts (le
// serveur valide directement le body JSON, pas de littéraux partagés nécessaires ici).
export const resetPasswordFormSchema = z
  .object({
    password:        z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
    confirmPassword: z.string(),
    token: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
