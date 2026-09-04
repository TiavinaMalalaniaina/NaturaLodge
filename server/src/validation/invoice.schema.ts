import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';

export const invoiceListQuerySchema = z.object({
  bookingId: z.string().optional(),
  guestId:   z.string().optional(),
  status:    z.string().optional(),
  // STANDARD (facture) / DEPOSIT (acompte) / CREDIT_NOTE (avoir) — voir invoice.service.ts.
  kind:      z.string().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(500).default(20),
});

export const generateInvoiceSchema = z.object({
  bookingId: z.string().min(1),
  taxRate:   z.number().min(0).max(100).default(0),
  notes:     z.string().optional(),
  dueAt:     z.string().datetime().optional(),
});

export const createDepositSchema = z.object({
  bookingId: z.string().min(1),
  amount:    z.number().int().positive(),
  notes:     z.string().optional(),
});

// `refundRatePercent` : override ponctuel du taux de remboursement par défaut
// (DEFAULT_CANCELLATION_REFUND_RATE) au moment d'annuler une facture déjà visée. Sans effet si la
// facture était encore un brouillon (suppression pure, pas d'avoir).
export const cancelInvoiceSchema = z.object({
  refundRatePercent: z.number().int().min(0).max(100).optional(),
});

// `status` n'est pas modifiable ici : PAID/PARTIALLY_PAID/PENDING sont recalculés automatiquement
// par syncInvoiceStatus() à partir des paiements, et CANCELLED passe par cancelInvoice() — seul
// chemin qui extourne la créance et le produit non encaissés dans le grand livre.
export const updateInvoiceSchema = z.object({
  notes:      z.string().optional(),
  dueAt:      z.string().datetime().nullable().optional(),
  taxAmount:  z.number().int().min(0).optional(),
});

export const paymentSchema = z.object({
  amount:    z.number().int().positive(),
  method:    z.nativeEnum(PaymentMethod),
  accountId: z.string().min(1),
  reference: z.string().optional(),
  notes:     z.string().optional(),
});

export type InvoiceListParams = z.infer<typeof invoiceListQuerySchema>;
export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type CreateDepositInput = z.infer<typeof createDepositSchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
