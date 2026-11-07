import { z } from 'zod';

const date = z.string({ required_error: 'Dates requises' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide').refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Date invalide');
export const staySchema = z.object({
  arrival: date,
  departure: date,
  guests: z.coerce.number({ invalid_type_error: 'Nombre de voyageurs invalide' }).int('Nombre de voyageurs invalide').min(1, 'Au moins un voyageur').max(100, 'Au plus 100 voyageurs'),
}).refine(value => value.departure > value.arrival, 'Le départ doit suivre l’arrivée')
  .refine(value => value.arrival >= new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Antananarivo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), 'Arrivée passée')
  .refine(value => (Date.parse(value.departure) - Date.parse(value.arrival)) / 86400000 <= 90, 'Séjour limité à 90 nuits');
export const requestSchema = z.object({
  arrival: date, departure: date, guests: z.number().int().min(1).max(100),
  name: z.string().trim().min(1, 'Indiquez votre nom').max(80, 'Nom trop long (80 caractères max.)'),
  email: z.string().trim().email('Adresse email invalide').max(254).transform(value => value.toLowerCase()),
  phone: z.string().trim().min(6, 'Numéro de téléphone trop court').max(30, 'Numéro de téléphone trop long').regex(/^[+0-9 ().-]+$/, 'Numéro de téléphone invalide (chiffres, espaces, + ( ) . - uniquement)'),
  notes: z.string().trim().max(1000, 'Message trop long (1000 caractères max.)').default(''),
  conditionsAccepted: z.literal(true, { errorMap: () => ({ message: 'Acceptez les conditions de la demande' }) }),
  lines: z.array(z.object({ roomTypeId: z.string().min(1).max(100), quantity: z.number().int().min(1).max(50), unitPrice: z.number().int().positive() })).min(1).max(20),
}).superRefine((value, ctx) => {
  const stay = staySchema.safeParse(value);
  if (!stay.success) for (const issue of stay.error.issues) ctx.addIssue({ code: 'custom', message: issue.message });
  if (new Set(value.lines.map(line => line.roomTypeId)).size !== value.lines.length) ctx.addIssue({ code: 'custom', message: 'Catégories dupliquées' });
});
export const approveSchema = z.object({
  paymentInstructions: z.string().trim().min(10).max(2000),
  hours: z.number().int().min(1).max(72).default(24),
});
export const rejectSchema = z.object({ reason: z.string().trim().min(3).max(1000) });
export type WebsiteRequestInput = z.infer<typeof requestSchema>;
