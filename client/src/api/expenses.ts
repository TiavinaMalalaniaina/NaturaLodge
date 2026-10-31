import { api } from './client';

export interface ExpenseCategorySummary {
  id:   string;
  name: string;
}

export interface Expense {
  id:          string;
  category:    ExpenseCategorySummary;
  amount:      number;
  description: string;
  incurredAt:  string;
  paidFrom:    { id: string; code: string; name: string };
  approvedBy:  { id: string; name: string; role: string } | null;
}

function normalizeExpense(raw: Expense): Expense {
  return { ...raw, incurredAt: raw.incurredAt.split('T')[0] };
}

export interface ExpensesListParams {
  categoryId?: string;
  page?:       number;
  limit?:      number;
  dateFrom?:   string;
  dateTo?:     string;
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
  const { data } = await api.get<ExpensesList>('/expenses', { params });
  return { data: (data.data as Expense[]).map(normalizeExpense), meta: data.meta };
};

export interface CreateExpensePayload {
  categoryId:  string;
  amount:      number;
  description: string;
  paidFromId:  string;
  incurredAt?: string;
}

export const createExpense = async (payload: CreateExpensePayload): Promise<Expense> => {
  const { data } = await api.post<Expense>('/expenses', payload);
  return normalizeExpense(data);
};

// ─── Catégories de dépense ───────────────────────────────────────

export interface ExpenseCategoryFull {
  id:       string;
  name:     string;
  account:  { id: string; code: string; name: string };
  isActive: boolean;
}

export const fetchExpenseCategories = async (): Promise<ExpenseCategoryFull[]> => {
  const { data } = await api.get<ExpenseCategoryFull[]>('/expenses/categories');
  return data;
};

export interface CreateExpenseCategoryPayload {
  name:      string;
  accountId: string;
}

export const createExpenseCategory = async (payload: CreateExpenseCategoryPayload): Promise<ExpenseCategoryFull> => {
  const { data } = await api.post<ExpenseCategoryFull>('/expenses/categories', payload);
  return data;
};

export interface UpdateExpenseCategoryPayload {
  name?:      string;
  accountId?: string;
  isActive?:  boolean;
}

export const updateExpenseCategory = async (id: string, payload: UpdateExpenseCategoryPayload): Promise<ExpenseCategoryFull> => {
  const { data } = await api.patch<ExpenseCategoryFull>(`/expenses/categories/${id}`, payload);
  return data;
};
