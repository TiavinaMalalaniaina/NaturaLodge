import { z } from 'zod';
import { ExpenseCategory } from '@prisma/client';

export const expenseListQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(500).default(20),
  category: z.nativeEnum(ExpenseCategory).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo:   z.string().datetime().optional(),
});

export const createExpenseSchema = z.object({
  category:    z.nativeEnum(ExpenseCategory),
  amount:      z.number().int().positive(),
  description: z.string().min(1),
  paidFromId:  z.string().min(1),
  incurredAt:  z.string().datetime().optional(),
});

export type ExpenseListParams = z.infer<typeof expenseListQuerySchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
