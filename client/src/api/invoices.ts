import { api } from './client';
import { EffectiveStatus } from './bookings';

// ─── Types ────────────────────────────────────────────────────────

export type InvoiceStatus = 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'online'  | 'mvola' | 'orange_money' ;
export type PaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded';
// standard = facture normale, deposit = acompte, credit_note = avoir.
export type InvoiceKind = 'standard' | 'deposit' | 'credit_note';

export interface InvoiceItem {
  id:          string;
  description: string;
  quantity:    number;
  unitPrice:   number;
  total:       number;
}

export interface InvoicePayment {
  id:          string;
  amount:      number;
  method:      PaymentMethod;
  status:      PaymentStatus;
  reference:   string | null;
  notes:       string | null;
  paidAt:      string;
  processedBy: { id: string; name: string; role: string };
  account:     { id: string; code: string; name: string };
}

export interface RelatedInvoiceRef {
  id:     string;
  number: string | null;
  kind:   InvoiceKind;
}

export interface Invoice {
  id:          string;
  // null tant que le document est un brouillon (pas encore visé) — voir `validatedAt`.
  number:      string | null;
  kind:        InvoiceKind;
  bookingId:   string;
  guestId:     string;
  status:      InvoiceStatus;
  // null = brouillon, librement modifiable, absent du grand livre. Non-null = visé (figé, posté
  // au grand livre) — c'est aussi la valeur qu'`issuedAt` prend au moment du visa.
  validatedAt: string | null;
  issuedAt:    string;
  dueAt:       string | null;
  paidAt:      string | null;
  totalAmount: number;
  taxAmount:   number;
  notes:       string | null;
  items:       InvoiceItem[];
  payments:    InvoicePayment[];
  // Présents uniquement sur le détail (getById/getByBookingId), pas sur la liste.
  relatesToInvoice?: RelatedInvoiceRef | null;
  creditedBy?:       (RelatedInvoiceRef & { totalAmount: number; validatedAt: string | null })[];
  booking: {
    id:        string;
    arrival:   string;
    departure: string;
    guest:     { id: string; name: string; email: string };
    // Présents sur la liste (GET /invoices) — absents sur le détail (booking.rooms y est, pas ça).
    effectiveStatus?: EffectiveStatus;
    rooms?: {
      room:     { id: string; number: string; rateOverride: number | null; roomType: { name: string } };
      roomRate: number;
      arrival:  string;
      departure: string;
    }[];
  };
}

// ─── Normalizer ───────────────────────────────────────────────────

const STATUS_MAP: Record<string, InvoiceStatus> = {
  PENDING: 'pending', PAID: 'paid', PARTIALLY_PAID: 'partially_paid',
  REFUNDED: 'refunded', CANCELLED: 'cancelled',
};

const PAYMENT_METHOD_MAP: Record<string, PaymentMethod> = {
  CASH: 'cash', CARD: 'card', BANK_TRANSFER: 'bank_transfer', ONLINE: 'online',
};

const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  COMPLETED: 'completed', PENDING: 'pending', FAILED: 'failed', REFUNDED: 'refunded',
};

const KIND_MAP: Record<string, InvoiceKind> = {
  STANDARD: 'standard', DEPOSIT: 'deposit', CREDIT_NOTE: 'credit_note',
};

function normalizeRelatedRef(raw: any): RelatedInvoiceRef {
  return { id: raw.id, number: raw.number, kind: KIND_MAP[raw.kind] ?? 'standard' };
}

function normalizeInvoice(raw: any): Invoice {
  return {
    ...raw,
    status:      STATUS_MAP[raw.status]  ?? 'pending',
    kind:        KIND_MAP[raw.kind] ?? 'standard',
    validatedAt: raw.validatedAt ? raw.validatedAt.split('T')[0] : null,
    issuedAt: raw.issuedAt.split('T')[0],
    dueAt:    raw.dueAt  ? raw.dueAt.split('T')[0]  : null,
    paidAt:   raw.paidAt ? raw.paidAt.split('T')[0] : null,
    relatesToInvoice: raw.relatesToInvoice ? normalizeRelatedRef(raw.relatesToInvoice) : null,
    creditedBy: (raw.creditedBy ?? []).map((c: any) => ({ ...normalizeRelatedRef(c), totalAmount: c.totalAmount, validatedAt: c.validatedAt ? c.validatedAt.split('T')[0] : null })),
    payments: (raw.payments ?? []).map((p: any) => ({
      ...p,
      method: PAYMENT_METHOD_MAP[p.method] ?? p.method,
      status: PAYMENT_STATUS_MAP[p.status] ?? p.status,
      paidAt: p.paidAt.split('T')[0],
    })),
    booking: raw.booking ? {
      ...raw.booking,
      arrival:   raw.booking.arrival.split('T')[0],
      departure: raw.booking.departure.split('T')[0],
      rooms: (raw.booking.rooms ?? []).map((br: any) => ({
        ...br,
        arrival:   br.arrival.split('T')[0],
        departure: br.departure.split('T')[0],
      })),
    } : raw.booking,
  };
}

// ─── API calls ────────────────────────────────────────────────────

export const fetchInvoiceByBooking = async (bookingId: string): Promise<Invoice> => {
  const { data } = await api.get<any>(`/invoices/booking/${bookingId}`);
  return normalizeInvoice(data);
};

export const fetchInvoice = async (id: string): Promise<Invoice> => {
  const { data } = await api.get<any>(`/invoices/${id}`);
  return normalizeInvoice(data);
};

export interface GeneratePayload {
  bookingId: string;
  taxRate?:  number;
  notes?:    string;
  dueAt?:    string;
}

export const generateInvoice = async (payload: GeneratePayload): Promise<Invoice> => {
  const { data } = await api.post<any>('/invoices/generate', payload);
  return normalizeInvoice(data);
};

export interface PaymentPayload {
  amount:    number;
  method:    string;
  accountId: string;
  reference?: string;
  notes?:    string;
}

export const recordPayment = async (invoiceId: string, payload: PaymentPayload): Promise<Invoice> => {
  const { data } = await api.post<any>(`/invoices/${invoiceId}/payments`, {
    ...payload,
    method: payload.method.toUpperCase(),
  });
  return normalizeInvoice(data);
};

export const voidPayment = async (invoiceId: string, paymentId: string): Promise<Invoice> => {
  const { data } = await api.delete<any>(`/invoices/${invoiceId}/payments/${paymentId}`);
  return normalizeInvoice(data);
};

export const updateInvoice = async (id: string, payload: { notes?: string; taxAmount?: number; dueAt?: string | null }): Promise<Invoice> => {
  const { data } = await api.patch<any>(`/invoices/${id}`, payload);
  return normalizeInvoice(data);
};

export interface CreateDepositPayload {
  bookingId: string;
  amount:    number;
  notes?:    string;
}

export const createDeposit = async (payload: CreateDepositPayload): Promise<Invoice> => {
  const { data } = await api.post<any>('/invoices/deposit', payload);
  return normalizeInvoice(data);
};

// Vise un brouillon (acompte, facture ou avoir) : lui assigne son numéro définitif et le poste au
// grand livre — irréversible, le document est ensuite figé.
export const validateInvoice = async (id: string): Promise<Invoice> => {
  const { data } = await api.post<any>(`/invoices/${id}/validate`);
  return normalizeInvoice(data);
};

export type CancelInvoiceResult =
  | { deleted: true }
  | { deleted: false; creditNote: Invoice };

// Brouillon jamais visé : supprimé, aucun document produit. Facture visée : émet un avoir en
// brouillon (`refundRatePercent` en pourcentage rendu au client, défaut serveur si omis).
export const cancelInvoice = async (id: string, refundRatePercent?: number): Promise<CancelInvoiceResult> => {
  const { data } = await api.post<any>(`/invoices/${id}/cancel`, refundRatePercent !== undefined ? { refundRatePercent } : {});
  return data.deleted ? { deleted: true } : { deleted: false, creditNote: normalizeInvoice(data.creditNote) };
};

export interface InvoicesListParams {
  bookingId?: string;
  guestId?:   string;
  status?:    string;
  kind?:      InvoiceKind;
  page?:      number;
  limit?:     number;
}

export interface InvoicesList {
  data: Invoice[];
  meta: {
    total:       number;
    page:        number;
    limit:       number;
    totalPages:  number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export const fetchInvoices = async (params?: InvoicesListParams): Promise<InvoicesList> => {
  const { data } = await api.get<any>('/invoices', { params });
  return {
    data: (data.data as any[]).map(normalizeInvoice),
    meta: data.meta,
  };
};
