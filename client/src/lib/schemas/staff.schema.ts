import { z } from 'zod';

// Schéma Zod côté client, volontairement distinct de server/src/validation/staff.schema.ts :
// le client normalise les enums en minuscules (cf. convention CLAUDE.md), donc pas de partage
// littéral possible avec le schéma serveur (qui valide des enums Prisma en MAJUSCULES).
export const staffFormSchema = z
  .object({
    name:            z.string().min(1, 'Le nom est requis'),
    email:           z.string().email('Adresse email invalide'),
    password:        z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
    confirmPassword: z.string(),
    role:            z.enum(['admin', 'manager', 'receptionist', 'housekeeping']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export type StaffFormValues = z.infer<typeof staffFormSchema>;
