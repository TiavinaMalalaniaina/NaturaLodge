import { z } from 'zod';

// Schéma Zod côté client, volontairement distinct de server/src/validation/staff.schema.ts (le
// serveur valide directement le body JSON, pas de littéraux partagés nécessaires ici).
export const staffFormSchema = z
  .object({
    name:            z.string().min(1, 'Le nom est requis'),
    username:        z.string().min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères")
                        .regex(/^[a-z0-9._-]+$/i, 'Lettres, chiffres, points, tirets uniquement'),
    email:           z.string().email('Adresse email invalide').optional().or(z.literal('')),
    password:        z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
    confirmPassword: z.string(),
    roleId:          z.string().min(1, 'Le rôle est requis'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export type StaffFormValues = z.infer<typeof staffFormSchema>;
