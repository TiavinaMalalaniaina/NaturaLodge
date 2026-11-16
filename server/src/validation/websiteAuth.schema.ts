import { z } from 'zod';

const email = z.string().trim().email('Adresse email invalide').max(254).transform(value => value.toLowerCase());
const next = z.enum(['/reservation', '/mes-reservations']).default('/mes-reservations');
const locale = z.enum(['fr', 'en']).default('fr');
const token = z.string().regex(/^[a-f0-9]{64}$/);
// bcrypt ignore tout ce qui dépasse 72 octets : refuser plutôt que tronquer en silence.
const newPassword = z.string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .refine(value => Buffer.byteLength(value) <= 72, 'Mot de passe trop long (72 caractères max.)');

export const registerSchema = z.object({ email, password: newPassword, next, locale });
export const loginSchema = z.object({ email, password: z.string().min(1, 'Indiquez votre mot de passe').max(200) });
export const forgotPasswordSchema = z.object({ email, next, locale });
export const verifyEmailSchema = z.object({ token });
export const resetPasswordSchema = z.object({ token, password: newPassword });
export const googleStartSchema = z.object({ next, locale });
