import { z } from 'zod';
import { LedgerAccountType, PaymentMethod } from '@prisma/client';

export const ledgerEntriesQuerySchema = z.object({
  accountId: z.string().min(1),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(500).default(20),
  dateFrom:  z.string().datetime().optional(),
  dateTo:    z.string().datetime().optional(),
});

export const ledgerSummaryQuerySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo:   z.string().datetime().optional(),
});

export const transferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId:   z.string().min(1),
  amount:        z.number().int().positive(),
  fee:           z.number().int().min(0).optional(),
  memo:          z.string().optional(),
}).refine(d => d.fromAccountId !== d.toAccountId, {
  message: 'Le compte source et le compte destination doivent être différents.',
  path:    ['toAccountId'],
});

export const contributionSchema = z.object({
  toAccountId: z.string().min(1),
  amount:      z.number().int().positive(),
  memo:        z.string().optional(),
});

export const balanceSheetQuerySchema = z.object({
  asOf: z.string().datetime().optional(),
});

export const exportQuerySchema = z.object({
  accountId: z.string().optional(),
  dateFrom:  z.string().datetime().optional(),
  dateTo:    z.string().datetime().optional(),
});

export const createAccountSchema = z.object({
  code:           z.string().min(1).max(20),
  name:           z.string().min(1).max(120),
  type:           z.nativeEnum(LedgerAccountType),
  isCashAccount:  z.boolean().default(false),
  allowedMethods: z.array(z.nativeEnum(PaymentMethod)).default([]),
});

// Le code et le type sont volontairement absents : voir le commentaire dans
// ledger.service.ts::updateAccount — ils ne doivent jamais changer après création.
export const updateAccountSchema = z.object({
  name:           z.string().min(1).max(120).optional(),
  isCashAccount:  z.boolean().optional(),
  allowedMethods: z.array(z.nativeEnum(PaymentMethod)).optional(),
  isActive:       z.boolean().optional(),
});

export type LedgerEntriesParams = z.infer<typeof ledgerEntriesQuerySchema>;
export type LedgerSummaryParams = z.infer<typeof ledgerSummaryQuerySchema>;
export type TransferInput = z.infer<typeof transferSchema>;
export type ContributionInput = z.infer<typeof contributionSchema>;
export type BalanceSheetParams = z.infer<typeof balanceSheetQuerySchema>;
export type ExportQueryParams = z.infer<typeof exportQuerySchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
