import { z } from 'zod';

export const roomTypeSchema = z.object({
  name:        z.string().min(1),
  rate:        z.number().int().positive(),
  description: z.string().optional().default(''),
  area:        z.number().int().positive().optional().default(30),
  bedType:     z.string().optional().default('King Size'),
  capacity:    z.number().int().min(1).max(20).optional().default(2),
  view:        z.string().optional().default('Garden View'),
  featureIds:  z.array(z.string()).optional(),
});

export type RoomTypeInput = z.infer<typeof roomTypeSchema>;
