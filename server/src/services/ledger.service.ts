import { JournalSource, LedgerAccountType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ConflictError, NotFoundError } from '../errors/AppError';

// Les comptes ASSET/EXPENSE ont un solde normal débiteur, LIABILITY/EQUITY/REVENUE un solde
// normal créditeur — Σdebit − Σcredit est la donnée brute en base, ce helper la remet dans le
// sens "positif = normal pour ce type de compte" pour l'affichage.
function normalBalance(type: LedgerAccountType, rawBalance: number): number {
  return type === 'ASSET' || type === 'EXPENSE' ? rawBalance : -rawBalance;
}

type PrismaOrTx = Prisma.TransactionClient | typeof prisma;

// Une ligne référence un compte soit par son code (comptes fixes du plan comptable, ex: '411000'),
// soit par son id (comptes de trésorerie choisis dynamiquement par l'utilisateur, ex: le compte
// Mvola précis sélectionné au moment d'un paiement) — jamais les deux à la fois.
export type JournalLineInput =
  | { accountCode: string; accountId?: never; debit?: number; credit?: number; description?: string }
  | { accountId: string; accountCode?: never; debit?: number; credit?: number; description?: string };

export type PostEntryInput = {
  source: JournalSource;
  memo?: string;
  date?: Date;
  postedById?: string;
  relatedPaymentId?: string;
  relatedInvoiceId?: string;
  relatedExpenseId?: string;
  lines: JournalLineInput[];
};

async function generateEntryNumber(client: PrismaOrTx): Promise<string> {
  const year  = new Date().getFullYear();
  const count = await client.journalEntry.count();
  return `JE-${year}-${String(count + 1).padStart(4, '0')}`;
}

// Point de passage unique pour toute écriture comptable : aucune JournalLine ne doit être créée
// ailleurs. Vérifie l'équilibre (Σdebit === Σcredit) avant de committer — c'est l'invariant de
// base de la partie double, non exprimable comme contrainte SQL native sur plusieurs lignes.
// `txTimeoutMs` : dépasse le défaut Prisma (5000ms) uniquement quand appelé hors transaction sur
// une base distante à forte latence (ex: backfillLedgerHistory.ts contre une base de prod) — sans
// effet quand un `client` transactionnel est déjà fourni par l'appelant.
export async function postEntry(data: PostEntryInput, client: PrismaOrTx = prisma, txTimeoutMs?: number) {
  if (data.lines.length < 2) {
    throw new ConflictError('Une écriture comptable doit comporter au moins deux lignes.');
  }

  const totalDebit  = data.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = data.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (totalDebit !== totalCredit) {
    throw new ConflictError(`Écriture déséquilibrée : débit ${totalDebit} ≠ crédit ${totalCredit}.`);
  }
  if (totalDebit === 0) {
    throw new ConflictError('Une écriture comptable ne peut pas être nulle.');
  }

  const codes = [...new Set(data.lines.filter(l => l.accountCode).map(l => l.accountCode!))];
  const ids   = [...new Set(data.lines.filter(l => l.accountId).map(l => l.accountId!))];
  // Séquentiel, pas Promise.all : les deux requêtes partagent potentiellement la même connexion
  // de transaction (adapter pg), qui ne supporte pas les requêtes concurrentes sur un même client.
  const byCode = codes.length ? await client.ledgerAccount.findMany({ where: { code: { in: codes } } }) : [];
  const byId   = ids.length   ? await client.ledgerAccount.findMany({ where: { id: { in: ids } } })     : [];
  const accountByCode = new Map(byCode.map(a => [a.code, a]));
  const accountById   = new Map(byId.map(a => [a.id, a]));
  for (const code of codes) {
    if (!accountByCode.has(code)) throw new NotFoundError(`Compte comptable "${code}"`);
  }
  for (const id of ids) {
    if (!accountById.has(id)) throw new NotFoundError(`Compte comptable "${id}"`);
  }

  const run = async (tx: PrismaOrTx) => {
    const number = await generateEntryNumber(tx);
    return tx.journalEntry.create({
      data: {
        number,
        source:           data.source,
        memo:              data.memo ?? null,
        date:              data.date ?? new Date(),
        postedById:        data.postedById ?? null,
        relatedPaymentId:  data.relatedPaymentId ?? null,
        relatedInvoiceId:  data.relatedInvoiceId ?? null,
        relatedExpenseId:  data.relatedExpenseId ?? null,
        lines: {
          create: data.lines.map(l => ({
            accountId:   l.accountCode ? accountByCode.get(l.accountCode)!.id : accountById.get(l.accountId!)!.id,
            debit:       l.debit ?? 0,
            credit:      l.credit ?? 0,
            description: l.description ?? null,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });
  };

  // Appelé hors transaction : la numérotation + création des lignes doit rester atomique, même
  // logique que generateInvoiceNumber dans invoice.service.ts. Appelé avec un `tx` existant
  // (Phase 2/3, écriture postée dans la même transaction que l'opération métier) : pas de
  // transaction imbriquée, on l'exécute directement dans celle du client.
  return client === prisma
    ? prisma.$transaction(run, txTimeoutMs ? { timeout: txTimeoutMs } : undefined)
    : run(client);
}

export type TransferParams = {
  fromAccountId: string;
  toAccountId:   string;
  amount:        number;
  fee?:          number;
  memo?:         string;
  performedById?: string;
};

// Déplace de l'argent entre deux comptes de trésorerie de l'hôtel (ex: dépôt d'espèces en
// banque) — jamais une vraie sortie, juste un changement de lieu. Sans frais, toujours équilibrée
// par construction (deux lignes sur des comptes ASSET). Avec frais : la source paie le montant
// PLUS les frais (débitée de amount + fee), la destination reçoit le montant plein — les frais
// partent en charge (627000 Frais bancaires et de transfert), pas prélevés sur ce qui arrive.
export async function transfer(params: TransferParams) {
  if (params.fromAccountId === params.toAccountId) {
    throw new ConflictError('Le compte source et le compte destination doivent être différents.');
  }

  const [from, to] = await Promise.all([
    prisma.ledgerAccount.findUnique({ where: { id: params.fromAccountId } }),
    prisma.ledgerAccount.findUnique({ where: { id: params.toAccountId } }),
  ]);
  if (!from) throw new NotFoundError('Compte source');
  if (!to)   throw new NotFoundError('Compte destination');
  if (!from.isCashAccount || !to.isCashAccount) {
    throw new ConflictError('Un virement ne peut se faire qu\'entre deux comptes de trésorerie.');
  }

  const fee = params.fee ?? 0;

  return postEntry({
    source:     'TRANSFER',
    postedById: params.performedById,
    memo:       params.memo ?? `Virement ${from.name} vers ${to.name}`,
    lines: [
      { accountId: params.toAccountId,   debit:  params.amount },
      ...(fee > 0 ? [{ accountCode: '627000', debit: fee } as const] : []),
      { accountId: params.fromAccountId, credit: params.amount + fee },
    ],
  });
}

export type ContributionParams = {
  toAccountId:   string;
  amount:        number;
  memo?:         string;
  performedById?: string;
};

// Argent injecté depuis l'extérieur de l'hôtel (apport du propriétaire, etc.) — Débit le compte
// de trésorerie choisi / Crédit 101000 Capital. Symétrique d'une dépense (Débit charge / Crédit
// trésorerie), mais ici la contrepartie est aux capitaux propres, pas une charge.
export async function recordContribution(params: ContributionParams) {
  const account = await prisma.ledgerAccount.findUnique({ where: { id: params.toAccountId } });
  if (!account) throw new NotFoundError('Compte de trésorerie');
  if (!account.isCashAccount) {
    throw new ConflictError('Un apport ne peut être crédité que sur un compte de trésorerie.');
  }

  return postEntry({
    source:     'CONTRIBUTION',
    postedById: params.performedById,
    memo:       params.memo ?? `Apport — ${account.name}`,
    lines: [
      { accountId: params.toAccountId, debit:  params.amount },
      { accountCode: '101000',         credit: params.amount },
    ],
  });
}

export async function getCashAccountsBalances() {
  const accounts = await prisma.ledgerAccount.findMany({
    where:   { isCashAccount: true, isActive: true },
    orderBy: { code: 'asc' },
  });

  const totals = await prisma.journalLine.groupBy({
    by:     ['accountId'],
    where:  { accountId: { in: accounts.map(a => a.id) } },
    _sum:   { debit: true, credit: true },
  });
  const totalsByAccountId = new Map(totals.map(t => [t.accountId, t]));

  return accounts.map(account => {
    const t = totalsByAccountId.get(account.id);
    const balance = (t?._sum.debit ?? 0) - (t?._sum.credit ?? 0);
    return { ...account, balance };
  });
}

export type AccountEntriesParams = {
  accountId: string;
  dateFrom?: string;
  dateTo?:   string;
  page:      number;
  limit:     number;
};

// Relevé de compte façon relevé bancaire : une ligne par écriture qui touche ce compte, la plus
// récente en premier.
export async function getAccountEntries(params: AccountEntriesParams) {
  const { accountId, dateFrom, dateTo, page, limit } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.JournalLineWhereInput = {
    accountId,
    ...(dateFrom || dateTo ? {
      entry: {
        date: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo   ? { lte: new Date(dateTo) }   : {}),
        },
      },
    } : {}),
  };

  const [lines, total] = await Promise.all([
    prisma.journalLine.findMany({
      where, skip, take: limit,
      include: { entry: { select: { number: true, date: true, source: true, memo: true } } },
      orderBy: { entry: { date: 'desc' } },
    }),
    prisma.journalLine.count({ where }),
  ]);

  return {
    data: lines,
    meta: {
      total, page, limit,
      totalPages:  Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}

export type SummaryParams = { dateFrom?: string; dateTo?: string };

// Résumé période : revenu facturé (comptabilité d'engagement, compte 706) vs réellement encaissé
// (mouvements de trésorerie liés à un paiement/annulation), et dépenses groupées par catégorie —
// répond à "combien j'ai gagné / dépensé sur cette période" sans naviguer le grand livre.
export async function getSummary(params: SummaryParams) {
  const dateFilter = {
    ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
    ...(params.dateTo   ? { lte: new Date(params.dateTo) }   : {}),
  };
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  const revenueAccount = await prisma.ledgerAccount.findFirst({ where: { code: '706000' } });
  const revenueLines = revenueAccount ? await prisma.journalLine.findMany({
    where: { accountId: revenueAccount.id, ...(hasDateFilter ? { entry: { date: dateFilter } } : {}) },
  }) : [];
  const revenueInvoiced = revenueLines.reduce((s, l) => s + l.credit - l.debit, 0);

  const cashAccounts = await prisma.ledgerAccount.findMany({ where: { isCashAccount: true } });
  const paymentLines = await prisma.journalLine.findMany({
    where: {
      accountId: { in: cashAccounts.map(a => a.id) },
      entry: {
        source: { in: ['PAYMENT', 'PAYMENT_VOID'] },
        ...(hasDateFilter ? { date: dateFilter } : {}),
      },
    },
  });
  const revenueCollected = paymentLines.reduce((s, l) => s + l.debit - l.credit, 0);

  const expenseTotals = await prisma.expense.groupBy({
    by:    ['category'],
    where: hasDateFilter ? { incurredAt: dateFilter } : {},
    _sum:  { amount: true },
  });
  const expensesByCategory = expenseTotals.map(e => ({ category: e.category, total: e._sum.amount ?? 0 }));
  const totalExpenses = expensesByCategory.reduce((s, e) => s + e.total, 0);

  return {
    revenueInvoiced,
    revenueCollected,
    expensesByCategory,
    totalExpenses,
    netCashFlow: revenueCollected - totalExpenses,
  };
}

export async function getAccountBalance(accountId: string) {
  const account = await prisma.ledgerAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new NotFoundError('Compte comptable');

  const totals = await prisma.journalLine.aggregate({
    where: { accountId },
    _sum:  { debit: true, credit: true },
  });
  const rawBalance = (totals._sum.debit ?? 0) - (totals._sum.credit ?? 0);

  return { account, balance: normalBalance(account.type, rawBalance) };
}

export type BalanceSheetRow = { id: string; code: string; name: string; balance: number };

// Bilan simplifié à une date donnée : agrégation des soldes par type de compte. Actif = Passif +
// Capitaux propres + résultat cumulé non affecté (produits − charges, jamais "clôturés" vers les
// capitaux propres faute d'exercice comptable formel) — invariant vérifiable via `balanced`.
export async function getBalanceSheet(asOf?: string) {
  const dateFilter = asOf ? { lte: new Date(asOf) } : undefined;

  const accounts = await prisma.ledgerAccount.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
  const totals = await prisma.journalLine.groupBy({
    by:    ['accountId'],
    where: dateFilter ? { entry: { date: dateFilter } } : {},
    _sum:  { debit: true, credit: true },
  });
  const totalsByAccountId = new Map(totals.map(t => [t.accountId, t]));

  const rows = accounts.map(a => {
    const t   = totalsByAccountId.get(a.id);
    const raw = (t?._sum.debit ?? 0) - (t?._sum.credit ?? 0);
    return { id: a.id, code: a.code, name: a.name, type: a.type, balance: normalBalance(a.type, raw) };
  }).filter(r => r.balance !== 0);

  const byType = (type: LedgerAccountType): BalanceSheetRow[] =>
    rows.filter(r => r.type === type).map(({ id, code, name, balance }) => ({ id, code, name, balance }));
  const sumOf = (list: BalanceSheetRow[]) => list.reduce((s, r) => s + r.balance, 0);

  const assets      = byType('ASSET');
  const liabilities = byType('LIABILITY');
  const equity      = byType('EQUITY');
  const revenue     = byType('REVENUE');
  const expense     = byType('EXPENSE');

  const totalAssets      = sumOf(assets);
  const totalLiabilities = sumOf(liabilities);
  const netIncomeToDate  = sumOf(revenue) - sumOf(expense);
  const totalEquity      = sumOf(equity) + netIncomeToDate;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  return {
    asOf: asOf ?? null,
    assets, liabilities, equity,
    netIncomeToDate,
    totalAssets, totalLiabilities, totalEquity, totalLiabilitiesAndEquity,
    balanced: totalAssets === totalLiabilitiesAndEquity,
  };
}

// Compte de résultat comptable (produits/charges par compte, en partie double) sur une période —
// distinct de getSummary() qui donne une vue trésorerie (encaissé vs facturé) par catégorie métier.
export async function getIncomeStatement(params: SummaryParams) {
  const dateFilter = {
    ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
    ...(params.dateTo   ? { lte: new Date(params.dateTo) }   : {}),
  };
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  const accounts = await prisma.ledgerAccount.findMany({
    where:   { type: { in: ['REVENUE', 'EXPENSE'] }, isActive: true },
    orderBy: { code: 'asc' },
  });
  const totals = await prisma.journalLine.groupBy({
    by:    ['accountId'],
    where: { accountId: { in: accounts.map(a => a.id) }, ...(hasDateFilter ? { entry: { date: dateFilter } } : {}) },
    _sum:  { debit: true, credit: true },
  });
  const totalsByAccountId = new Map(totals.map(t => [t.accountId, t]));

  const rows = accounts.map(a => {
    const t   = totalsByAccountId.get(a.id);
    const raw = (t?._sum.debit ?? 0) - (t?._sum.credit ?? 0);
    return { code: a.code, name: a.name, type: a.type, total: normalBalance(a.type, raw) };
  }).filter(r => r.total !== 0);

  const revenue      = rows.filter(r => r.type === 'REVENUE').map(({ code, name, total }) => ({ code, name, total }));
  const expenses      = rows.filter(r => r.type === 'EXPENSE').map(({ code, name, total }) => ({ code, name, total }));
  const totalRevenue  = revenue.reduce((s, r) => s + r.total, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.total, 0);

  return {
    dateFrom: params.dateFrom ?? null,
    dateTo:   params.dateTo   ?? null,
    revenue, expenses, totalRevenue, totalExpenses,
    netIncome: totalRevenue - totalExpenses,
  };
}

export type ExportParams = { accountId?: string; dateFrom?: string; dateTo?: string };

// Grand livre exportable en CSV pour transmission à un expert-comptable — une ligne par écriture,
// ordre chronologique (comme un vrai grand livre, pas le plus-récent-d'abord de getAccountEntries).
export async function exportEntriesCsv(params: ExportParams): Promise<string> {
  const where: Prisma.JournalLineWhereInput = {
    ...(params.accountId ? { accountId: params.accountId } : {}),
    ...(params.dateFrom || params.dateTo ? {
      entry: {
        date: {
          ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
          ...(params.dateTo   ? { lte: new Date(params.dateTo) }   : {}),
        },
      },
    } : {}),
  };

  const lines = await prisma.journalLine.findMany({
    where,
    include: { entry: true, account: true },
    orderBy: [{ entry: { date: 'asc' } }, { entry: { number: 'asc' } }],
  });

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ['Date', 'Numéro écriture', 'Source', 'Code compte', 'Compte', 'Description', 'Débit', 'Crédit'].join(',');
  const rows = lines.map(l => [
    l.entry.date.toISOString().slice(0, 10),
    l.entry.number,
    l.entry.source,
    l.account.code,
    escape(l.account.name),
    escape(l.description ?? l.entry.memo ?? ''),
    String(l.debit),
    String(l.credit),
  ].join(','));

  return [header, ...rows].join('\n');
}
