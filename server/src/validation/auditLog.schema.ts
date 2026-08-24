import { z } from 'zod';

export const auditLogQuerySchema = z.object({
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(200).default(50),
  userId:       z.string().optional(),
  resourceType: z.string().optional(),
  dateFrom:     z.string().datetime().optional(),
  dateTo:       z.string().datetime().optional(),
});

export type AuditLogQueryParams = z.infer<typeof auditLogQuerySchema>;
