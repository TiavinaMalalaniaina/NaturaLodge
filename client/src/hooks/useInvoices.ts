import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchInvoiceByBooking, fetchInvoice, fetchInvoices,
  generateInvoice, recordPayment, voidPayment, updateInvoice,
  addInvoiceItem, updateInvoiceItem, deleteInvoiceItem, addInvoiceDiscount,
  PaymentPayload, InvoiceItemPayload, DiscountPayload,
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

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, ...payload }: { invoiceId: string } & PaymentPayload) =>
      recordPayment(invoiceId, payload),
    onSuccess: (inv) => {
      qc.setQueryData([...INVOICES_KEY, 'booking', inv.bookingId], inv);
      qc.setQueryData([...INVOICES_KEY, inv.id], inv);
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
      qc.setQueryData([...INVOICES_KEY, 'booking', inv.bookingId], inv);
      qc.setQueryData([...INVOICES_KEY, inv.id], inv);
      qc.invalidateQueries({ queryKey: CASH_ACCOUNTS_KEY });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateInvoice>[1]) =>
      updateInvoice(id, payload),
    onSuccess: (inv) => {
      qc.setQueryData([...INVOICES_KEY, 'booking', inv.bookingId], inv);
      qc.setQueryData([...INVOICES_KEY, inv.id], inv);
    },
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
