import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchExpenses, createExpense, fetchExpenseCategories, createExpenseCategory, updateExpenseCategory,
  UpdateExpenseCategoryPayload,
} from '../api/expenses';
import { CASH_ACCOUNTS_KEY } from './useLedger';

export const EXPENSES_KEY = ['expenses'] as const;
export const EXPENSE_CATEGORIES_KEY = ['expenses', 'categories'] as const;

export function useExpenses(params?: Parameters<typeof fetchExpenses>[0]) {
  return useQuery({
    queryKey: [...EXPENSES_KEY, 'list', params],
    queryFn:  () => fetchExpenses(params),
    placeholderData: (prev) => prev,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXPENSES_KEY });
      qc.invalidateQueries({ queryKey: CASH_ACCOUNTS_KEY });
    },
  });
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: EXPENSE_CATEGORIES_KEY,
    queryFn:  fetchExpenseCategories,
  });
}

export function useCreateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createExpenseCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSE_CATEGORIES_KEY }),
  });
}

export function useUpdateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateExpenseCategoryPayload }) => updateExpenseCategory(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSE_CATEGORIES_KEY }),
  });
}
