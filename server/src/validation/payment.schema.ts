import { z } from 'zod';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export const paymentListQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(500).default(20),
  status:   z.nativeEnum(PaymentStatus).optional(),
  method:   z.nativeEnum(PaymentMethod).optional(),
  guestId:  z.string().optional(),
  search:   z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo:   z.string().datetime().optional(),
});

export type PaymentListParams = z.infer<typeof paymentListQuerySchema>;
