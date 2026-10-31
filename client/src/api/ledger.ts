import { api } from './client';

export interface CashAccount {
  id:      string;
  code:    string;
  name:    string;
  balance: number;
  allowedMethods: string[];
}

export const fetchCashAccounts = async (): Promise<CashAccount[]> => {
  const { data } = await api.get<CashAccount[]>('/ledger/cash-accounts');
  return data.map(a => ({ ...a, allowedMethods: (a.allowedMethods ?? []).map((m: string) => m.toLowerCase()) }));
};

// Mêmes comptes que fetchCashAccounts, regroupés par préfixe de code (ex: BMOI + BNI sous
// "512 · Banque") — voir groupByCodePrefix côté serveur. `isGroup` distingue un en-tête de
// regroupement (jamais sélectionnable comme compte) d'un vrai compte.
export interface CashAccountGroupRow {
  id:      string;
  code:    string;
  name:    string;
  balance: number;
  depth:   number;
  isGroup: boolean;
}

export const fetchCashAccountGroups = async (): Promise<CashAccountGroupRow[]> => {
  const { data } = await api.get<CashAccountGroupRow[]>('/ledger/cash-account-groups');
  return data;
};

export type LedgerAccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface LedgerAccountFull {
  id:             string;
  code:           string;
  name:           string;
  type:           LedgerAccountType;
  isCashAccount:  boolean;
  allowedMethods: string[];
  isActive:       boolean;
}

export const fetchAllAccounts = async (): Promise<LedgerAccountFull[]> => {
  const { data } = await api.get<LedgerAccountFull[]>('/ledger/accounts');
  return data;
};

export interface CreateAccountPayload {
  code:           string;
  name:           string;
  type:           LedgerAccountType;
  isCashAccount:  boolean;
  allowedMethods: string[];
}

export const createAccount = async (payload: CreateAccountPayload): Promise<LedgerAccountFull> => {
  const { data } = await api.post<LedgerAccountFull>('/ledger/accounts', payload);
  return data;
};

export interface UpdateAccountPayload {
  name?:           string;
  isCashAccount?:  boolean;
  allowedMethods?: string[];
  isActive?:       boolean;
}

export const updateAccount = async (id: string, payload: UpdateAccountPayload): Promise<LedgerAccountFull> => {
  const { data } = await api.patch<LedgerAccountFull>(`/ledger/accounts/${id}`, payload);
  return data;
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
  expensesByCategory: { categoryId: string; categoryName: string; total: number }[];
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
  depth:   number;
  isGroup: boolean;
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

export const fetchBalanceSheet = async (asOf?: string, includeZero?: boolean): Promise<BalanceSheet> => {
  const { data } = await api.get<BalanceSheet>('/ledger/balance-sheet', { params: { asOf, includeZero } });
  return data;
};

export interface IncomeStatementRow {
  id:      string;
  code:    string;
  name:    string;
  total:   number;
  depth:   number;
  isGroup: boolean;
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

// ─── Accès trésorerie (écran d'administration) ──────────────────────────────

export interface TreasuryAccessGrant {
  roleId:          string;
  accountId:       string;
  canTransferFrom: boolean;
  canTransferTo:   boolean;
  canPayExpenses:  boolean;
}

export interface TreasuryAccessConfig {
  roles:            { id: string; name: string }[];
  cashAccounts:     { id: string; code: string; name: string }[];
  grants:           TreasuryAccessGrant[];
  accessAllRoleIds: string[];
}

export const fetchTreasuryAccess = async (): Promise<TreasuryAccessConfig> => {
  const { data } = await api.get<TreasuryAccessConfig>('/ledger/access');
  return data;
};

export interface RoleTreasuryGrantInput {
  accountId:       string;
  canTransferFrom: boolean;
  canTransferTo:   boolean;
  canPayExpenses:  boolean;
}

export const saveRoleTreasuryAccess = async (roleId: string, grants: RoleTreasuryGrantInput[]): Promise<TreasuryAccessConfig> => {
  const { data } = await api.put<TreasuryAccessConfig>(`/ledger/access/${roleId}`, { grants });
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
