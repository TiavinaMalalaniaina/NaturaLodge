import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchInvoiceByBooking, fetchInvoice, fetchInvoices,
  generateInvoice, recordPayment, voidPayment, updateInvoice,
  createDeposit, validateInvoice, cancelInvoice,
  PaymentPayload, CreateDepositPayload,
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

export function useInvoices(params?: Parameters<typeof fetchInvoices>[0]) {
  return useQuery({
    queryKey: [...INVOICES_KEY, 'list', params],
    queryFn:  () => fetchInvoices(params),
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
