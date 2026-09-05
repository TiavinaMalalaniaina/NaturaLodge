import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';

export const invoiceListQuerySchema = z.object({
  bookingId: z.string().optional(),
  guestId:   z.string().optional(),
  status:    z.string().optional(),
  // STANDARD (facture) / DEPOSIT (acompte) / CREDIT_NOTE (avoir) — voir invoice.service.ts.
  kind:      z.string().optional(),
  // true = uniquement les brouillons (validatedAt null) ; false = uniquement les documents visés.
  // Omis = pas de filtre sur l'état de validation.
  draft:     z.coerce.boolean().optional(),
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
  // Réservé au brouillon d'ACOMPTE : réécrit le montant de l'acompte (et sa ligne unique) avant
  // visa. Rejeté sur une facture STANDARD (montant issu de la réservation) ou un document visé.
  amount:     z.number().int().positive().optional(),
});

export const paymentSchema = z.object({
  amount:    z.number().int().positive(),
  method:    z.nativeEnum(PaymentMethod),
  accountId: z.string().min(1),
  reference: z.string().optional(),
  notes:     z.string().optional(),
});

// Ligne personnalisée ("dépense flexible") ajoutée à la main sur une facture. `unitPrice` peut être
// négatif (remise / avoir) — c'est le seul champ montant qui l'autorise dans tout le domaine
// facturation. `quantity` reste strictement positif : une remise se saisit via un prix unitaire
// négatif, pas une quantité négative.
export const invoiceItemSchema = z.object({
  description: z.string().min(1).max(200),
  quantity:    z.number().int().positive().default(1),
  unitPrice:   z.number().int(),
});

export const updateInvoiceItemSchema = z.object({
  description: z.string().min(1).max(200).optional(),
  quantity:    z.number().int().positive().optional(),
  unitPrice:   z.number().int().optional(),
});

// Remise sur facture : `value` est toujours saisie en positif (le service la porte en négatif).
// mode 'percent' → pourcentage entier 1–100, recalculé à chaque resynchronisation ; mode 'fixed' →
// montant en Ariary, figé.
export const invoiceDiscountSchema = z.object({
  mode:  z.enum(['percent', 'fixed']),
  value: z.number().int().positive(),
  label: z.string().min(1).max(200).optional(),
}).refine(d => d.mode !== 'percent' || d.value <= 100, {
  message: 'Une remise en pourcentage ne peut pas dépasser 100.',
  path: ['value'],
});

export type InvoiceListParams = z.infer<typeof invoiceListQuerySchema>;
export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type CreateDepositInput = z.infer<typeof createDepositSchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type UpdateInvoiceItemInput = z.infer<typeof updateInvoiceItemSchema>;
export type InvoiceDiscountInput = z.infer<typeof invoiceDiscountSchema>;
