import { api } from './client';

export type ExtraPricing = 'per_night' | 'one_time';

const PRICING_MAP: Record<string, ExtraPricing> = {
  PER_NIGHT: 'per_night',
  ONE_TIME:  'one_time',
};
const PRICING_TO_API: Record<ExtraPricing, string> = {
  per_night: 'PER_NIGHT',
  one_time:  'ONE_TIME',
};

export interface Extra {
  id:       string;
  name:     string;
  price:    number;
  pricing:  ExtraPricing;
  isActive: boolean;
}

interface ApiExtra {
  id: string; name: string; price: number; pricing: string; isActive: boolean;
}

function normalizeExtra(e: ApiExtra): Extra {
  return {
    id:       e.id,
    name:     e.name,
    price:    e.price,
    pricing:  PRICING_MAP[e.pricing] ?? 'one_time',
    isActive: e.isActive,
  };
}

export const fetchExtras = async (): Promise<Extra[]> => {
  const { data } = await api.get<ApiExtra[]>('/extras');
  return data.map(normalizeExtra);
};

export const fetchExtra = async (id: string): Promise<Extra> => {
  const { data } = await api.get<ApiExtra>(`/extras/${id}`);
  return normalizeExtra(data);
};

export interface ExtraPayload {
  name:      string;
  price:     number;
  pricing?:  ExtraPricing;
  isActive?: boolean;
}

export const createExtra = async (payload: ExtraPayload): Promise<Extra> => {
  const { data } = await api.post<ApiExtra>('/extras', {
    ...payload,
    ...(payload.pricing ? { pricing: PRICING_TO_API[payload.pricing] } : {}),
  });
  return normalizeExtra(data);
};

export const updateExtra = async (id: string, payload: Partial<ExtraPayload>): Promise<Extra> => {
  const { data } = await api.patch<ApiExtra>(`/extras/${id}`, {
    ...payload,
    ...(payload.pricing ? { pricing: PRICING_TO_API[payload.pricing] } : {}),
  });
  return normalizeExtra(data);
};

export const deleteExtra = async (id: string): Promise<void> => {
  await api.delete(`/extras/${id}`);
};
