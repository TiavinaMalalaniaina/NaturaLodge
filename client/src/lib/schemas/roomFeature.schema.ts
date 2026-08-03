import { z } from 'zod';

export const roomFeatureFormSchema = z.object({
  label:    z.string().min(1, 'Le libellé est requis'),
  iconName: z.string().min(1),
});

export type RoomFeatureFormValues = z.infer<typeof roomFeatureFormSchema>;
