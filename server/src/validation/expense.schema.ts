import { z } from 'zod';

export const expenseListQuerySchema = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(500).default(20),
  categoryId: z.string().min(1).optional(),
  dateFrom:   z.string().datetime().optional(),
  dateTo:     z.string().datetime().optional(),
});

export const createExpenseSchema = z.object({
  categoryId:  z.string().min(1),
  amount:      z.number().int().positive(),
  description: z.string().min(1),
  paidFromId:  z.string().min(1),
  incurredAt:  z.string().datetime().optional(),
});

export const createExpenseCategorySchema = z.object({
  name:      z.string().min(1).max(80),
  accountId: z.string().min(1),
});

export const updateExpenseCategorySchema = z.object({
  name:      z.string().min(1).max(80).optional(),
  accountId: z.string().min(1).optional(),
  isActive:  z.boolean().optional(),
});

export type ExpenseListParams = z.infer<typeof expenseListQuerySchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;
