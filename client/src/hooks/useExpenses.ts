import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchExpenses, createExpense } from '../api/expenses';
import { CASH_ACCOUNTS_KEY } from './useLedger';

export const EXPENSES_KEY = ['expenses'] as const;

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
