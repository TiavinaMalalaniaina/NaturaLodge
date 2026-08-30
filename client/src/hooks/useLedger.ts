import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCashAccounts, fetchLedgerEntries, fetchLedgerSummary, createTransfer, createContribution,
  fetchBalanceSheet, fetchIncomeStatement, fetchAllAccounts, createAccount, updateAccount,
  UpdateAccountPayload,
} from '../api/ledger';

export const CASH_ACCOUNTS_KEY = ['ledger', 'cash-accounts'] as const;
export const ALL_ACCOUNTS_KEY = ['ledger', 'accounts'] as const;
export const LEDGER_ENTRIES_KEY = ['ledger', 'entries'] as const;
export const LEDGER_SUMMARY_KEY = ['ledger', 'summary'] as const;
export const BALANCE_SHEET_KEY = ['ledger', 'balance-sheet'] as const;
export const INCOME_STATEMENT_KEY = ['ledger', 'income-statement'] as const;

export function useCashAccounts() {
  return useQuery({
    queryKey: CASH_ACCOUNTS_KEY,
    queryFn:  fetchCashAccounts,
    staleTime: 60_000,
  });
}

export function useLedgerEntries(params: Parameters<typeof fetchLedgerEntries>[0] | null) {
  return useQuery({
    queryKey: [...LEDGER_ENTRIES_KEY, params],
    queryFn:  () => fetchLedgerEntries(params!),
    enabled:  !!params?.accountId,
    placeholderData: (prev) => prev,
  });
}

export function useLedgerSummary(params?: Parameters<typeof fetchLedgerSummary>[0]) {
  return useQuery({
    queryKey: [...LEDGER_SUMMARY_KEY, params],
    queryFn:  () => fetchLedgerSummary(params),
    placeholderData: (prev) => prev,
  });
}

export function useBalanceSheet(asOf?: string) {
  return useQuery({
    queryKey: [...BALANCE_SHEET_KEY, asOf],
    queryFn:  () => fetchBalanceSheet(asOf),
    placeholderData: (prev) => prev,
  });
}

export function useIncomeStatement(params?: Parameters<typeof fetchIncomeStatement>[0]) {
  return useQuery({
    queryKey: [...INCOME_STATEMENT_KEY, params],
    queryFn:  () => fetchIncomeStatement(params),
    placeholderData: (prev) => prev,
  });
}

export function useAllAccounts() {
  return useQuery({
    queryKey: ALL_ACCOUNTS_KEY,
    queryFn:  fetchAllAccounts,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ALL_ACCOUNTS_KEY });
      qc.invalidateQueries({ queryKey: CASH_ACCOUNTS_KEY });
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAccountPayload }) => updateAccount(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ALL_ACCOUNTS_KEY });
      qc.invalidateQueries({ queryKey: CASH_ACCOUNTS_KEY });
    },
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTransfer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CASH_ACCOUNTS_KEY });
      qc.invalidateQueries({ queryKey: LEDGER_ENTRIES_KEY });
      qc.invalidateQueries({ queryKey: LEDGER_SUMMARY_KEY });
    },
  });
}

export function useCreateContribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createContribution,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CASH_ACCOUNTS_KEY });
      qc.invalidateQueries({ queryKey: LEDGER_ENTRIES_KEY });
      qc.invalidateQueries({ queryKey: LEDGER_SUMMARY_KEY });
      qc.invalidateQueries({ queryKey: BALANCE_SHEET_KEY });
    },
  });
}
