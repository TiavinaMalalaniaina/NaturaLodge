import { api } from './client';
import { EffectiveStatus } from './bookings';

// ─── Types ────────────────────────────────────────────────────────

export type InvoiceStatus = 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'online'  | 'mvola' | 'orange_money' ;
export type PaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded';

export type InvoiceItemSource = 'booking' | 'manual';

export interface InvoiceItem {
  id:           string;
  description:  string;
  quantity:     number;
  unitPrice:    number;
  total:        number;
  source:       InvoiceItemSource;
  // Renseigné uniquement pour une remise en pourcentage (1–100).
  discountRate: number | null;
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

export interface Invoice {
  id:          string;
  number:      string;
  bookingId:   string;
  guestId:     string;
  status:      InvoiceStatus;
  issuedAt:    string;
  dueAt:       string | null;
  paidAt:      string | null;
  totalAmount: number;
  taxAmount:   number;
  notes:       string | null;
  items:       InvoiceItem[];
  payments:    InvoicePayment[];
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

function normalizeInvoice(raw: any): Invoice {
  return {
    ...raw,
    status:   STATUS_MAP[raw.status]  ?? 'pending',
    issuedAt: raw.issuedAt.split('T')[0],
    dueAt:    raw.dueAt  ? raw.dueAt.split('T')[0]  : null,
    paidAt:   raw.paidAt ? raw.paidAt.split('T')[0] : null,
    items:    (raw.items ?? []).map((it: any) => ({
      ...it,
      source: (it.source ?? 'BOOKING').toLowerCase() as InvoiceItemSource,
    })),
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

export interface InvoiceItemPayload {
  description: string;
  quantity:   number;
  unitPrice:  number;
}

export const addInvoiceItem = async (invoiceId: string, payload: InvoiceItemPayload): Promise<Invoice> => {
  const { data } = await api.post<any>(`/invoices/${invoiceId}/items`, payload);
  return normalizeInvoice(data);
};

export const updateInvoiceItem = async (invoiceId: string, itemId: string, payload: Partial<InvoiceItemPayload>): Promise<Invoice> => {
  const { data } = await api.patch<any>(`/invoices/${invoiceId}/items/${itemId}`, payload);
  return normalizeInvoice(data);
};

export const deleteInvoiceItem = async (invoiceId: string, itemId: string): Promise<Invoice> => {
  const { data } = await api.delete<any>(`/invoices/${invoiceId}/items/${itemId}`);
  return normalizeInvoice(data);
};

export interface DiscountPayload {
  mode:   'percent' | 'fixed';
  value:  number;
  label?: string;
}

export const addInvoiceDiscount = async (invoiceId: string, payload: DiscountPayload): Promise<Invoice> => {
  const { data } = await api.post<any>(`/invoices/${invoiceId}/discounts`, payload);
  return normalizeInvoice(data);
};

export interface InvoicesListParams {
  bookingId?: string;
  guestId?:   string;
  status?:    string;
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
