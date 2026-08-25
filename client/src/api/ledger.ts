import { api } from './client';

export interface CashAccount {
  id:      string;
  code:    string;
  name:    string;
  balance: number;
  allowedMethods: string[];
}

export const fetchCashAccounts = async (): Promise<CashAccount[]> => {
  const { data } = await api.get<any[]>('/ledger/cash-accounts');
  return data.map(a => ({ ...a, allowedMethods: (a.allowedMethods ?? []).map((m: string) => m.toLowerCase()) }));
};

export interface LedgerEntry {
  id:          string;
  debit:       number;
  credit:      number;
  description: string | null;
  entry: {
    number: string;
    date:   string;
    source: string;
    memo:   string | null;
  };
}

export interface LedgerEntriesList {
  data: LedgerEntry[];
  meta: {
    total:       number;
    page:        number;
    limit:       number;
    totalPages:  number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface LedgerEntriesParams {
  accountId: string;
  dateFrom?: string;
  dateTo?:   string;
  page?:     number;
  limit?:    number;
}

export const fetchLedgerEntries = async (params: LedgerEntriesParams): Promise<LedgerEntriesList> => {
  const { data } = await api.get<LedgerEntriesList>('/ledger/entries', { params });
  return data;
};

export interface LedgerSummary {
  revenueInvoiced:  number;
  revenueCollected: number;
  expensesByCategory: { category: string; total: number }[];
  totalExpenses:    number;
  netCashFlow:      number;
}

export interface LedgerSummaryParams {
  dateFrom?: string;
  dateTo?:   string;
}

export const fetchLedgerSummary = async (params?: LedgerSummaryParams): Promise<LedgerSummary> => {
  const { data } = await api.get<LedgerSummary>('/ledger/summary', { params });
  return data;
};

export interface TransferPayload {
  fromAccountId: string;
  toAccountId:   string;
  amount:        number;
  fee?:          number;
  memo?:         string;
}

export const createTransfer = async (payload: TransferPayload): Promise<void> => {
  await api.post('/ledger/transfer', payload);
};

export interface ContributionPayload {
  toAccountId: string;
  amount:      number;
  memo?:       string;
}

export const createContribution = async (payload: ContributionPayload): Promise<void> => {
  await api.post('/ledger/contributions', payload);
};

export interface BalanceSheetRow {
  id:      string;
  code:    string;
  name:    string;
  balance: number;
}

export interface BalanceSheet {
  asOf:                       string | null;
  assets:                     BalanceSheetRow[];
  liabilities:                BalanceSheetRow[];
  equity:                     BalanceSheetRow[];
  netIncomeToDate:            number;
  totalAssets:                number;
  totalLiabilities:           number;
  totalEquity:                number;
  totalLiabilitiesAndEquity:  number;
  balanced:                   boolean;
}

export const fetchBalanceSheet = async (asOf?: string): Promise<BalanceSheet> => {
  const { data } = await api.get<BalanceSheet>('/ledger/balance-sheet', { params: { asOf } });
  return data;
};

export interface IncomeStatementRow {
  code:  string;
  name:  string;
  total: number;
}

export interface IncomeStatement {
  dateFrom:      string | null;
  dateTo:        string | null;
  revenue:       IncomeStatementRow[];
  expenses:      IncomeStatementRow[];
  totalRevenue:  number;
  totalExpenses: number;
  netIncome:     number;
}

export const fetchIncomeStatement = async (params?: LedgerSummaryParams): Promise<IncomeStatement> => {
  const { data } = await api.get<IncomeStatement>('/ledger/income-statement', { params });
  return data;
};

export interface ExportParams {
  accountId?: string;
  dateFrom?:  string;
  dateTo?:    string;
}

export const exportLedgerCsv = async (params?: ExportParams): Promise<Blob> => {
  const { data } = await api.get('/ledger/export', { params, responseType: 'blob' });
  return data;
};
