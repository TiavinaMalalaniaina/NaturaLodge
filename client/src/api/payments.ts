import { api } from './client';
import { PaymentMethod, PaymentStatus } from './invoices';

const PAYMENT_METHOD_MAP: Record<string, PaymentMethod> = {
  CASH: 'cash', CARD: 'card', BANK_TRANSFER: 'bank_transfer', ONLINE: 'online',
};

const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  COMPLETED: 'completed', PENDING: 'pending', FAILED: 'failed', REFUNDED: 'refunded',
};

export interface PaymentRecord {
  id:          string;
  amount:      number;
  method:      PaymentMethod;
  status:      PaymentStatus;
  reference:   string | null;
  notes:       string | null;
  paidAt:      string;
  processedBy: { id: string; name: string; role: string };
  invoice: {
    id:        string;
    number:    string;
    bookingId: string;
    guest:     { id: string; name: string };
  };
}

interface ApiPayment {
  id: string; amount: number; method: string; status: string;
  reference: string | null; notes: string | null; paidAt: string;
  processedBy: { id: string; name: string; role: string };
  invoice: { id: string; number: string; bookingId: string; guest: { id: string; name: string } };
}

function normalizePayment(p: ApiPayment): PaymentRecord {
  return {
    ...p,
    method: PAYMENT_METHOD_MAP[p.method] ?? 'cash',
    status: PAYMENT_STATUS_MAP[p.status] ?? 'completed',
  };
}

export interface PaymentsListParams {
  page?:     number;
  limit?:    number;
  status?:   PaymentStatus;
  method?:   PaymentMethod;
  guestId?:  string;
  search?:   string;
  dateFrom?: string;
  dateTo?:   string;
}

export interface PaymentsList {
  data: PaymentRecord[];
  meta: {
    total:       number;
    page:        number;
    limit:       number;
    totalPages:  number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

const PAYMENT_METHOD_TO_API: Record<PaymentMethod, string> = {
  cash: 'CASH', card: 'CARD', bank_transfer: 'BANK_TRANSFER', online: 'ONLINE',
};
const PAYMENT_STATUS_TO_API: Record<PaymentStatus, string> = {
  completed: 'COMPLETED', pending: 'PENDING', failed: 'FAILED', refunded: 'REFUNDED',
};

export const fetchPayments = async (params?: PaymentsListParams): Promise<PaymentsList> => {
  const { data } = await api.get<{ data: ApiPayment[]; meta: PaymentsList['meta'] }>('/payments', {
    params: {
      ...params,
      ...(params?.status ? { status: PAYMENT_STATUS_TO_API[params.status] } : {}),
      ...(params?.method ? { method: PAYMENT_METHOD_TO_API[params.method] } : {}),
    },
  });
  return {
    data: data.data.map(normalizePayment),
    meta: data.meta,
  };
};
