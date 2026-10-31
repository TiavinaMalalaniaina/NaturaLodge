import { api } from './client';
import { EffectiveStatus } from './bookings';

// ─── Types ────────────────────────────────────────────────────────

export type InvoiceStatus = 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'online'  | 'mvola' | 'orange_money' ;
export type PaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded';
// standard = facture normale, deposit = acompte, credit_note = avoir.
export type InvoiceKind = 'standard' | 'deposit' | 'credit_note';

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

interface RawRelatedInvoiceRef {
  id: string;
  number: string | null;
  kind: keyof typeof KIND_MAP;
  payments?: {
    amount: number;
  }[];
}

export interface RelatedInvoiceRef {
  id:     string;
  number: string | null;
  kind:   InvoiceKind;
  // Somme des encaissements réels sur ce document. Fourni uniquement sur `relatesToInvoice` du
  // détail (getById) — sert à borner un remboursement d'avoir.
  collectedAmount?: number;
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
    // Horodatage réel du check-in/check-out (ISO, avec heure) — absents tant que le geste n'a pas
    // eu lieu. Présents uniquement sur le détail (getById/getByBookingId), voir invoiceInclude côté
    // serveur. Priment sur arrival/departure pour l'affichage une fois connus (InvoiceView/Document).
    checkedInAt?:  string | null;
    checkedOutAt?: string | null;
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

type RawCreditedInvoiceRef = RawRelatedInvoiceRef & {
  totalAmount: number;
  validatedAt: string | null;
};

type RawBookingRoom = Omit<
  NonNullable<Invoice["booking"]["rooms"]>[number],
  "arrival" | "departure"
> & {
  arrival: string;
  departure: string;
};

type RawBooking = Omit<
  Invoice["booking"],
  "arrival" | "departure" | "rooms"
> & {
  arrival: string;
  departure: string;
  rooms?: RawBookingRoom[] | null;
};

type RawInvoiceItem = Omit<InvoiceItem, "source"> & {
  source?: string | null;
};

type RawInvoicePayment = Omit<
  InvoicePayment,
  "method" | "status" | "paidAt"
> & {
  method: string;
  status: string;
  paidAt: string;
};

type RawInvoice = Omit<
  Invoice,
  | "status"
  | "kind"
  | "validatedAt"
  | "issuedAt"
  | "dueAt"
  | "paidAt"
  | "relatesToInvoice"
  | "creditedBy"
  | "items"
  | "payments"
  | "booking"
> & {
  status: string;
  kind: string;
  validatedAt?: string | null;
  issuedAt: string;
  dueAt?: string | null;
  paidAt?: string | null;
  relatesToInvoice?: RawRelatedInvoiceRef | null;
  creditedBy?: RawCreditedInvoiceRef[] | null;
  items?: RawInvoiceItem[] | null;
  payments?: RawInvoicePayment[] | null;
  booking: RawBooking;
};

// ─── Normalizer ───────────────────────────────────────────────────

const STATUS_MAP: Record<string, InvoiceStatus> = {
  PENDING: 'pending', PAID: 'paid', PARTIALLY_PAID: 'partially_paid',
  REFUNDED: 'refunded', CANCELLED: 'cancelled',
};

const PAYMENT_METHOD_MAP: Record<string, PaymentMethod> = {
  CASH: 'cash', CARD: 'card', BANK_TRANSFER: 'bank_transfer', ONLINE: 'online', MVOLA: 'mvola', ORANGE_MONEY: 'orange_money',
};

const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  COMPLETED: 'completed', PENDING: 'pending', FAILED: 'failed', REFUNDED: 'refunded',
};

const KIND_MAP: Record<string, InvoiceKind> = {
  STANDARD: 'standard', DEPOSIT: 'deposit', CREDIT_NOTE: 'credit_note',
};

function normalizeRelatedRef(raw: RawRelatedInvoiceRef): RelatedInvoiceRef {
  return {
    id: raw.id, number: raw.number, kind: KIND_MAP[raw.kind] ?? 'standard',
    ...(Array.isArray(raw.payments)
      ? { collectedAmount: raw.payments.reduce((s, p) => s + p.amount, 0) }
      : {}),
  };
}

export function normalizeInvoice(raw: RawInvoice): Invoice {
  return {
    ...raw,

    status: normalizeInvoiceStatus(raw.status),
    kind: normalizeInvoiceKind(raw.kind),

    validatedAt: raw.validatedAt
      ? raw.validatedAt.split("T")[0]
      : null,

    issuedAt: raw.issuedAt.split("T")[0],

    dueAt: raw.dueAt
      ? raw.dueAt.split("T")[0]
      : null,

    paidAt: raw.paidAt
      ? raw.paidAt.split("T")[0]
      : null,

    relatesToInvoice: raw.relatesToInvoice
      ? normalizeRelatedRef(raw.relatesToInvoice)
      : null,

    creditedBy: (raw.creditedBy ?? []).map((c) => ({
      ...normalizeRelatedRef(c),
      totalAmount: c.totalAmount,
      validatedAt: c.validatedAt
        ? c.validatedAt.split("T")[0]
        : null,
    })),

    items: (raw.items ?? []).map((item) => ({
      ...item,
      source: normalizeInvoiceItemSource(item.source),
    })),

    payments: (raw.payments ?? []).map((payment) => ({
      ...payment,
      method: normalizePaymentMethod(payment.method),
      status: normalizePaymentStatus(payment.status),
      paidAt: payment.paidAt.split("T")[0],
    })),

    booking: {
      ...raw.booking,

      arrival: raw.booking.arrival.split("T")[0],
      departure: raw.booking.departure.split("T")[0],

      rooms: (raw.booking.rooms ?? []).map((room) => ({
        ...room,
        arrival: room.arrival.split("T")[0],
        departure: room.departure.split("T")[0],
      })),
    },
  };
}

const INVOICE_STATUSES: readonly InvoiceStatus[] = [
  "pending",
  "paid",
  "partially_paid",
  "refunded",
  "cancelled",
];

const INVOICE_KINDS: readonly InvoiceKind[] = [
  "standard",
  "deposit",
  "credit_note",
];

const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "cash",
  "card",
  "bank_transfer",
  "online",
  "mvola",
  "orange_money",
];

const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "completed",
  "pending",
  "failed",
  "refunded",
];

function isInvoiceStatus(value: unknown): value is InvoiceStatus {
  return (
    typeof value === "string" &&
    INVOICE_STATUSES.some((status) => status === value)
  );
}

function isInvoiceKind(value: unknown): value is InvoiceKind {
  return (
    typeof value === "string" &&
    INVOICE_KINDS.some((kind) => kind === value)
  );
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    typeof value === "string" &&
    PAYMENT_METHODS.some((method) => method === value)
  );
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    typeof value === "string" &&
    PAYMENT_STATUSES.some((status) => status === value)
  );
}

function normalizeInvoiceStatus(value: string): InvoiceStatus {
  const mapped = STATUS_MAP[value as keyof typeof STATUS_MAP];
  return isInvoiceStatus(mapped) ? mapped : "pending";
}

function normalizeInvoiceKind(value: string): InvoiceKind {
  const mapped = KIND_MAP[value as keyof typeof KIND_MAP];
  return isInvoiceKind(mapped) ? mapped : "standard";
}

function normalizePaymentMethod(value: string): PaymentMethod {
  const mapped =
    PAYMENT_METHOD_MAP[value as keyof typeof PAYMENT_METHOD_MAP];

  if (isPaymentMethod(mapped)) return mapped;
  if (isPaymentMethod(value)) return value;

  throw new Error(`Méthode de paiement inconnue : ${value}`);
}

function normalizePaymentStatus(value: string): PaymentStatus {
  const mapped =
    PAYMENT_STATUS_MAP[value as keyof typeof PAYMENT_STATUS_MAP];

  if (isPaymentStatus(mapped)) return mapped;
  if (isPaymentStatus(value)) return value;

  throw new Error(`Statut de paiement inconnu : ${value}`);
}

function normalizeInvoiceItemSource(
  value: string | null | undefined,
): InvoiceItemSource {
  const normalized = (value ?? "BOOKING").toLowerCase();

  if (normalized === "booking" || normalized === "manual") {
    return normalized;
  }

  throw new Error(`Source de ligne de facture inconnue : ${value}`);
}

// ─── API calls ────────────────────────────────────────────────────

export const fetchInvoiceByBooking = async (bookingId: string): Promise<Invoice> => {
  const { data } = await api.get<RawInvoice>(`/invoices/booking/${bookingId}`);
  return normalizeInvoice(data);
};

export const fetchInvoice = async (id: string): Promise<Invoice> => {
  const { data } = await api.get<RawInvoice>(`/invoices/${id}`);
  return normalizeInvoice(data);
};

export interface GeneratePayload {
  bookingId: string;
  taxRate?:  number;
  notes?:    string;
  dueAt?:    string;
}

export const generateInvoice = async (payload: GeneratePayload): Promise<Invoice> => {
  const { data } = await api.post<RawInvoice>('/invoices/generate', payload);
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
  const { data } = await api.post<RawInvoice>(`/invoices/${invoiceId}/payments`, {
    ...payload,
    method: payload.method.toUpperCase(),
  });
  return normalizeInvoice(data);
};

export const voidPayment = async (invoiceId: string, paymentId: string): Promise<Invoice> => {
  const { data } = await api.delete<RawInvoice>(`/invoices/${invoiceId}/payments/${paymentId}`);
  return normalizeInvoice(data);
};

export const updateInvoice = async (id: string, payload: { notes?: string; taxAmount?: number; dueAt?: string | null; amount?: number }): Promise<Invoice> => {
  const { data } = await api.patch<RawInvoice>(`/invoices/${id}`, payload);
  return normalizeInvoice(data);
};

// Supprime un brouillon jamais visé (aucun impact comptable). 404/409 si le document est visé.
export const deleteDraftInvoice = async (id: string): Promise<void> => {
  await api.delete(`/invoices/${id}`);
};

export interface CreateDepositPayload {
  bookingId: string;
  amount:    number;
  notes?:    string;
}

export const createDeposit = async (payload: CreateDepositPayload): Promise<Invoice> => {
  const { data } = await api.post<RawInvoice>('/invoices/deposit', payload);
  return normalizeInvoice(data);
};

// Vise un brouillon (acompte, facture ou avoir) : lui assigne son numéro définitif et le poste au
// grand livre — irréversible, le document est ensuite figé.
export const validateInvoice = async (id: string): Promise<Invoice> => {
  const { data } = await api.post<RawInvoice>(`/invoices/${id}/validate`);
  return normalizeInvoice(data);
};

export type CancelInvoiceResult =
  | { deleted: true }
  | { deleted: false; creditNote: Invoice };

type CancelInvoiceResponse =
| { deleted: true }
| { deleted: false; creditNote: RawInvoice };

// Brouillon jamais visé : supprimé, aucun document produit. Facture visée : émet un avoir en
// brouillon (`refundRatePercent` en pourcentage rendu au client, défaut serveur si omis).
export const cancelInvoice = async (id: string, refundRatePercent?: number): Promise<CancelInvoiceResult> => {
  const { data } = await api.post<CancelInvoiceResponse>(`/invoices/${id}/cancel`, refundRatePercent !== undefined ? { refundRatePercent } : {});
  return data.deleted ? { deleted: true } : { deleted: false, creditNote: normalizeInvoice(data.creditNote) };
};

export interface InvoiceItemPayload {
  description: string;
  quantity:   number;
  unitPrice:  number;
}

export const addInvoiceItem = async (invoiceId: string, payload: InvoiceItemPayload): Promise<Invoice> => {
  const { data } = await api.post<RawInvoice>(`/invoices/${invoiceId}/items`, payload);
  return normalizeInvoice(data);
};

export const updateInvoiceItem = async (invoiceId: string, itemId: string, payload: Partial<InvoiceItemPayload>): Promise<Invoice> => {
  const { data } = await api.patch<RawInvoice>(`/invoices/${invoiceId}/items/${itemId}`, payload);
  return normalizeInvoice(data);
};

export const deleteInvoiceItem = async (invoiceId: string, itemId: string): Promise<Invoice> => {
  const { data } = await api.delete<RawInvoice>(`/invoices/${invoiceId}/items/${itemId}`);
  return normalizeInvoice(data);
};

export interface DiscountPayload {
  mode:   'percent' | 'fixed';
  value:  number;
  label?: string;
}

export const addInvoiceDiscount = async (invoiceId: string, payload: DiscountPayload): Promise<Invoice> => {
  const { data } = await api.post<RawInvoice>(`/invoices/${invoiceId}/discounts`, payload);
  return normalizeInvoice(data);
};

export interface InvoicesListParams {
  bookingId?: string;
  guestId?:   string;
  status?:    string;
  kind?:      InvoiceKind;
  // true = brouillons uniquement, false = documents visés uniquement, omis = pas de filtre.
  draft?:     boolean;
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

export interface RawInvoicesList {
  data: RawInvoice[];
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
  const { data } = await api.get<RawInvoicesList>('/invoices', { params });
  return {
    data: (data.data as RawInvoice[]).map(normalizeInvoice),
    meta: data.meta,
  };
};

export interface OutstandingDeposit {
  id:          string;
  number:      string | null;
  totalAmount: number;
  validatedAt: string;
  bookingId:   string;
  guest:       { id: string; name: string };
}

// Acomptes visés pas encore absorbés par la facture définitive de leur réservation — trace le
// solde du compte 419100 (avances et acomptes reçus) au bilan, réservation par réservation.
export const fetchOutstandingDeposits = async (): Promise<OutstandingDeposit[]> => {
  const { data } = await api.get<OutstandingDeposit[]>('/invoices/deposits/outstanding');
  return data.map(d => ({ ...d, validatedAt: d.validatedAt.split('T')[0] }));
};