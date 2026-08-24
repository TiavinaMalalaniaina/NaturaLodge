import { api } from './client';

export type ExpenseCategory = 'supplies' | 'utilities' | 'maintenance' | 'marketing' | 'salaries' | 'other';

export interface Expense {
  id:          string;
  category:    ExpenseCategory;
  amount:      number;
  description: string;
  incurredAt:  string;
  paidFrom:    { id: string; code: string; name: string };
  approvedBy:  { id: string; name: string; role: string } | null;
}

const CATEGORY_MAP: Record<string, ExpenseCategory> = {
  SUPPLIES: 'supplies', UTILITIES: 'utilities', MAINTENANCE: 'maintenance',
  MARKETING: 'marketing', SALARIES: 'salaries', OTHER: 'other',
};

function normalizeExpense(raw: any): Expense {
  return {
    ...raw,
    category:   CATEGORY_MAP[raw.category] ?? raw.category,
    incurredAt: raw.incurredAt.split('T')[0],
  };
}

export interface ExpensesListParams {
  category?: string;
  page?:     number;
  limit?:    number;
}

export interface ExpensesList {
  data: Expense[];
  meta: {
    total:       number;
    page:        number;
    limit:       number;
    totalPages:  number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export const fetchExpenses = async (params?: ExpensesListParams): Promise<ExpensesList> => {
  const { data } = await api.get<any>('/expenses', {
    params: { ...params, category: params?.category ? params.category.toUpperCase() : undefined },
  });
  return { data: (data.data as any[]).map(normalizeExpense), meta: data.meta };
};

export interface CreateExpensePayload {
  category:    string;
  amount:      number;
  description: string;
  paidFromId:  string;
  incurredAt?: string;
}

export const createExpense = async (payload: CreateExpensePayload): Promise<Expense> => {
  const { data } = await api.post<any>('/expenses', { ...payload, category: payload.category.toUpperCase() });
  return normalizeExpense(data);
};
