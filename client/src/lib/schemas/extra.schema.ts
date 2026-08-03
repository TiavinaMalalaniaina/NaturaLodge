import { z } from 'zod';

export const extraFormSchema = z.object({
  name:    z.string().min(1, 'Le nom est requis'),
  price:   z.number().int().positive('Le prix doit être positif'),
  pricing: z.enum(['per_night', 'one_time']),
});

export type ExtraFormValues = z.infer<typeof extraFormSchema>;
