import { z } from 'zod';
import { RoomStatus } from '@prisma/client';

export const roomFeatureSchema = z.object({
  label:    z.string().min(1),
  iconName: z.string().min(1),
});

export const roomSchema = z.object({
  number:      z.string().min(1),
  roomTypeId:  z.string().min(1),
  images:      z.array(z.string()).optional(),
  rateOverride: z.number().int().positive().nullable().optional(),
  status:      z.nativeEnum(RoomStatus).optional(),
});

export type RoomInput = z.infer<typeof roomSchema>;
export type RoomFeatureInput = z.infer<typeof roomFeatureSchema>;
