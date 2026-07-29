import { z } from 'zod';
import { ExtraPricing } from '@prisma/client';

export const extraSchema = z.object({
  name:     z.string().min(1),
  price:    z.number().int().positive(),
  pricing:  z.nativeEnum(ExtraPricing).default('ONE_TIME'),
  isActive: z.boolean().optional(),
});

export type ExtraInput = z.infer<typeof extraSchema>;
