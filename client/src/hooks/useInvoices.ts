import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchInvoiceByBooking, fetchInvoice, fetchInvoices, fetchOutstandingDeposits,
  generateInvoice, recordPayment, voidPayment, updateInvoice, deleteDraftInvoice,
  createDeposit, validateInvoice, cancelInvoice,
  addInvoiceItem, updateInvoiceItem, deleteInvoiceItem, addInvoiceDiscount,
  PaymentPayload, CreateDepositPayload, InvoiceItemPayload, DiscountPayload,
} from '../api/invoices';
import { CASH_ACCOUNTS_KEY } from './useLedger';

export const INVOICES_KEY = ['invoices'] as const;

export function useInvoiceByBooking(bookingId: string | null) {
  return useQuery({
    queryKey: [...INVOICES_KEY, 'booking', bookingId],
    queryFn:  () => fetchInvoiceByBooking(bookingId!),
    enabled:  !!bookingId,
    retry:    false, // 404 = pas de facture, ne pas retry
  });
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: [...INVOICES_KEY, id],
    queryFn:  () => fetchInvoice(id!),
    enabled:  !!id,
  });
}

export function useGenerateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: generateInvoice,
    onSuccess:  (inv) => {
      qc.setQueryData([...INVOICES_KEY, 'booking', inv.bookingId], inv);
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
    },
  });
}

// La clé ['invoices','booking',<bookingId>] (useInvoiceByBooking) ne contient QUE la facture
// STANDARD de la réservation. Un mutation sur un acompte ou un avoir ne doit jamais l'y écrire —
// sinon /invoices/:bookingId affiche l'acompte au lieu du formulaire de génération.
function writeInvoiceCaches(qc: ReturnType<typeof useQueryClient>, inv: Awaited<ReturnType<typeof recordPayment>>) {
  qc.setQueryData([...INVOICES_KEY, inv.id], inv);
  if (inv.kind === 'standard') qc.setQueryData([...INVOICES_KEY, 'booking', inv.bookingId], inv);
  qc.invalidateQueries({ queryKey: INVOICES_KEY });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, ...payload }: { invoiceId: string } & PaymentPayload) =>
      recordPayment(invoiceId, payload),
    onSuccess: (inv) => {
      writeInvoiceCaches(qc, inv);
      qc.invalidateQueries({ queryKey: CASH_ACCOUNTS_KEY });
    },
  });
}

export function useVoidPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, paymentId }: { invoiceId: string; paymentId: string }) =>
      voidPayment(invoiceId, paymentId),
    onSuccess: (inv) => {
      writeInvoiceCaches(qc, inv);
      qc.invalidateQueries({ queryKey: CASH_ACCOUNTS_KEY });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateInvoice>[1]) =>
      updateInvoice(id, payload),
    onSuccess: (inv) => writeInvoiceCaches(qc, inv),
  });
}

// Lignes personnalisées (dépenses flexibles) : le service renvoie la facture complète après avoir
// ajusté le grand livre (411000/706000) et resynchronisé les statuts facture + réservation. On
// rafraîchit la liste des factures en plus du détail, car totalAmount (donc « reste à payer »)
// change. Pas d'invalidation trésorerie : une ligne à crédit ne bouge aucun compte de caisse.
function invoiceItemMutationCallbacks(qc: ReturnType<typeof useQueryClient>) {
  return {
    onSuccess: (inv: Awaited<ReturnType<typeof addInvoiceItem>>) => {
      qc.setQueryData([...INVOICES_KEY, 'booking', inv.bookingId], inv);
      qc.setQueryData([...INVOICES_KEY, inv.id], inv);
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
    },
  };
}

export function useAddInvoiceItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, ...payload }: { invoiceId: string } & InvoiceItemPayload) =>
      addInvoiceItem(invoiceId, payload),
    ...invoiceItemMutationCallbacks(qc),
  });
}

export function useUpdateInvoiceItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, itemId, ...payload }: { invoiceId: string; itemId: string } & Partial<InvoiceItemPayload>) =>
      updateInvoiceItem(invoiceId, itemId, payload),
    ...invoiceItemMutationCallbacks(qc),
  });
}

export function useDeleteInvoiceItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, itemId }: { invoiceId: string; itemId: string }) =>
      deleteInvoiceItem(invoiceId, itemId),
    ...invoiceItemMutationCallbacks(qc),
  });
}

export function useAddInvoiceDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, ...payload }: { invoiceId: string } & DiscountPayload) =>
      addInvoiceDiscount(invoiceId, payload),
    ...invoiceItemMutationCallbacks(qc),
  });
}

export function useInvoices(params?: Parameters<typeof fetchInvoices>[0]) {
  return useQuery({
    queryKey: [...INVOICES_KEY, 'list', params],
    queryFn:  () => fetchInvoices(params),
  });
}

// Acomptes visés pas encore absorbés par une facture définitive — trace le solde du compte 419100
// au bilan (voir Reports.tsx).
export function useOutstandingDeposits() {
  return useQuery({
    queryKey: [...INVOICES_KEY, 'deposits', 'outstanding'],
    queryFn:  fetchOutstandingDeposits,
  });
}

// Documents (acompte/avoir) d'une réservation, pour le panneau "Historique des documents" — une
// requête filtrée côté serveur sur bookingId, pas de nouvel endpoint dédié.
export function useBookingDocuments(bookingId: string | null, kind: 'deposit' | 'credit_note') {
  return useQuery({
    queryKey: [...INVOICES_KEY, 'booking-documents', bookingId, kind],
    queryFn:  () => fetchInvoices({ bookingId: bookingId!, kind, limit: 50 }),
    enabled:  !!bookingId,
  });
}

// Ces trois mutations font apparaître ou disparaître un document plutôt que de simplement modifier
// celui déjà en cache : on invalide toute la clé plutôt que de cibler une seule entrée.
export function useCreateDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDepositPayload) => createDeposit(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVOICES_KEY }),
  });
}

export function useValidateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => validateInvoice(id),
    onSuccess: (inv) => {
      qc.setQueryData([...INVOICES_KEY, inv.id], inv);
      if (inv.kind === 'standard') qc.setQueryData([...INVOICES_KEY, 'booking', inv.bookingId], inv);
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
    },
  });
}

export function useCancelInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, refundRatePercent }: { id: string; refundRatePercent?: number }) => cancelInvoice(id, refundRatePercent),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVOICES_KEY }),
  });
}

// Suppression d'un brouillon jamais visé : le document disparaît, on invalide toute la clé.
export function useDeleteDraftInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDraftInvoice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVOICES_KEY }),
  });
}
