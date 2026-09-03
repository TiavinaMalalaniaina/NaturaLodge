import { JournalSource, LedgerAccountType, PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ConflictError, NotFoundError } from '../errors/AppError';
import {
  assertCanTransfer, assertCanViewCashAccount, cashAccountVisibilityFilter,
  invalidateTreasuryAccessCache,
} from '../lib/treasuryAccess';

// Les comptes ASSET/EXPENSE ont un solde normal débiteur, LIABILITY/EQUITY/REVENUE un solde
// normal créditeur — Σdebit − Σcredit est la donnée brute en base, ce helper la remet dans le
// sens "positif = normal pour ce type de compte" pour l'affichage.
function normalBalance(type: LedgerAccountType, rawBalance: number): number {
  return type === 'ASSET' || type === 'EXPENSE' ? rawBalance : -rawBalance;
}

function longestCommonPrefix(codes: string[]): string {
  let prefix = codes[0];
  for (const code of codes.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < code.length && prefix[i] === code[i]) i++;
    prefix = prefix.slice(0, i);
    if (prefix === '') break;
  }
  return prefix;
}

type PrefixLeaf = { id: string; code: string; name: string; balance: number };
type PrefixRow  = PrefixLeaf & { depth: number; isGroup: boolean };
type PrefixNode =
  | { kind: 'leaf'; leaf: PrefixLeaf }
  | { kind: 'group'; prefix: string; children: PrefixNode[]; balance: number; label?: string };

// Regroupe des comptes par préfixe de code commun, façon plan comptable français (512100 BMOI et
// 512200 BNI partagent "512" → un en-tête de section virtuel "512" apparaît avec la somme des
// deux). Purement dérivé du code, aucune configuration à saisir : un groupe n'apparaît que là où
// au moins deux comptes partagent un préfixe non vide, et les niveaux intermédiaires sans
// embranchement réel (ex: "51" s'il n'y a que la famille "512" en dessous) sont absorbés
// automatiquement — même compression qu'un radix trie. Si un compte réel du plan comptable porte
// exactement ce préfixe comme code (ex: code "512", nom "Banque" — un vrai "compte collectif"),
// son nom sert de libellé au groupe au lieu d'être listé comme un sous-compte de plus.
function buildPrefixTree(items: PrefixLeaf[]): PrefixNode[] {
  if (items.length <= 1) return items.map(leaf => ({ kind: 'leaf', leaf }));

  const prefix = longestCommonPrefix(items.map(i => i.code));
  const selfAccount = prefix.length > 0 ? items.find(i => i.code === prefix) : undefined;
  const rest = selfAccount ? items.filter(i => i !== selfAccount) : items;

  const buckets = new Map<string, PrefixLeaf[]>();
  for (const item of rest) {
    const ch = item.code[prefix.length] ?? '';
    if (!buckets.has(ch)) buckets.set(ch, []);
    buckets.get(ch)!.push(item);
  }

  const childNodes: PrefixNode[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.length === 1) childNodes.push({ kind: 'leaf', leaf: bucket[0] });
    else childNodes.push(...buildPrefixTree(bucket));
  }

  if (prefix.length > 0 && (childNodes.length > 1 || selfAccount)) {
    return [{
      kind: 'group', prefix, children: childNodes,
      balance: items.reduce((s, i) => s + i.balance, 0),
      label: selfAccount?.name,
    }];
  }
  // Aucun préfixe commun exploitable (racine) ou un seul enfant après compression — pas d'en-tête
  // à afficher, on remonte les enfants directement.
  return childNodes;
}

function collectLeafNames(nodes: PrefixNode[]): string[] {
  const names: string[] = [];
  for (const node of nodes) {
    if (node.kind === 'leaf') names.push(node.leaf.name);
    else names.push(...collectLeafNames(node.children));
  }
  return names;
}

// Libellé d'un groupe : les mots communs en début de nom parmi ses comptes (ex: "Mobile Money —
// Mvola" / "Mobile Money — Orange Money..." → "Mobile Money"), comparaison mot par mot (jamais
// caractère par caractère, sinon "Caisse principale" et "Clients" se retrouveraient groupés à tort
// juste parce qu'ils commencent tous les deux par "C"). Vide si les comptes du groupe n'ont rien
// en commun dans leur nom — le préfixe de code brut reste alors le seul libellé affiché.
function commonWordPrefix(names: string[]): string {
  const wordLists = names.map(n => n.trim().split(/\s+/));
  const first = wordLists[0];
  let count = 0;
  while (count < first.length && wordLists.every(words => words[count]?.toLowerCase() === first[count].toLowerCase())) {
    count++;
  }
  return first.slice(0, count).join(' ').replace(/[-–—:]+$/, '').trim();
}

function flattenPrefixTree(nodes: PrefixNode[], depth: number, out: PrefixRow[]): void {
  for (const node of nodes) {
    if (node.kind === 'leaf') {
      out.push({ ...node.leaf, depth, isGroup: false });
    } else {
      // Le nom d'un vrai compte collectif (code == préfixe) prime sur la déduction par mots
      // communs — plus fiable, et permet des noms de sous-comptes courts sans mot répété.
      const label = node.label ?? commonWordPrefix(collectLeafNames(node.children));
      const name  = label ? `${node.prefix} · ${label}` : node.prefix;
      out.push({ id: `group:${node.prefix}`, code: node.prefix, name, balance: node.balance, depth, isGroup: true });
      flattenPrefixTree(node.children, depth + 1, out);
    }
  }
}

function groupByCodePrefix(leaves: PrefixLeaf[]): PrefixRow[] {
  const rows: PrefixRow[] = [];
  flattenPrefixTree(buildPrefixTree(leaves), 0, rows);
  return rows;
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
  performedById?:   string;
  performedByRole?: string;
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
  if (params.performedByRole) {
    await assertCanTransfer(params.performedByRole, params.fromAccountId, params.toAccountId);
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
  performedById?:   string;
  performedByRole?: string;
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
  if (params.performedByRole) {
    await assertCanViewCashAccount(params.performedByRole, params.toAccountId);
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

export async function getCashAccountsBalances(roleName: string) {
  const visible = await cashAccountVisibilityFilter(roleName);
  const accounts = (await prisma.ledgerAccount.findMany({
    where:   { isCashAccount: true, isActive: true },
    orderBy: { code: 'asc' },
  })).filter(a => visible(a.id));

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

// Même comptes que getCashAccountsBalances(), mais regroupés par les 3 premiers chiffres du code
// (ex: BMOI et BNI, tous deux "512xxx", apparaissent sous un en-tête "512 · Banque") — un seul
// niveau, volontairement plus simple que le regroupement en cascade de getBalanceSheet (5→51→512)
// qui n'a de sens que pour un relevé texte, pas pour une grille de cartes. Le libellé vient du
// compte collectif à ce code s'il existe (voir seedChartOfAccounts.ts), sinon le code brut sert
// d'en-tête. Un préfixe partagé par un seul compte n'est pas encapsulé dans un groupe.
export async function getCashAccountGroups(roleName: string) {
  const visible = await cashAccountVisibilityFilter(roleName);
  const accounts = (await prisma.ledgerAccount.findMany({
    where:   { isCashAccount: true, isActive: true },
    orderBy: { code: 'asc' },
  })).filter(a => visible(a.id));
  if (accounts.length === 0) return [];

  const totals = await prisma.journalLine.groupBy({
    by:    ['accountId'],
    where: { accountId: { in: accounts.map(a => a.id) } },
    _sum:  { debit: true, credit: true },
  });
  const totalsByAccountId = new Map(totals.map(t => [t.accountId, t]));

  const groupCodes = [...new Set(accounts.map(a => a.code.slice(0, 3)))];
  const groupAccounts = await prisma.ledgerAccount.findMany({ where: { code: { in: groupCodes } } });
  const groupNameByCode = new Map(groupAccounts.map(g => [g.code, g.name]));

  const byGroupCode = new Map<string, typeof accounts>();
  for (const a of accounts) {
    const groupCode = a.code.slice(0, 3);
    if (!byGroupCode.has(groupCode)) byGroupCode.set(groupCode, []);
    byGroupCode.get(groupCode)!.push(a);
  }

  const rows: { id: string; code: string; name: string; balance: number; depth: number; isGroup: boolean }[] = [];
  for (const [groupCode, members] of byGroupCode) {
    const withBalance = members.map(a => {
      const t = totalsByAccountId.get(a.id);
      return { account: a, balance: (t?._sum.debit ?? 0) - (t?._sum.credit ?? 0) };
    });
    const label = groupNameByCode.get(groupCode);
    // Sans compte collectif dédié à ce préfixe, un seul membre ne mérite pas d'en-tête (juste du
    // bruit visuel) — mais si un collectif existe (ex: "530 · Caisse principale"), son libellé
    // prime : affiché même pour un seul sous-compte, pour rester cohérent une fois qu'un deuxième
    // compte rejoindra le groupe plus tard.
    if (members.length === 1 && !label) {
      const { account, balance } = withBalance[0];
      rows.push({ id: account.id, code: account.code, name: account.name, balance, depth: 0, isGroup: false });
      continue;
    }
    rows.push({
      id: `group:${groupCode}`, code: groupCode, name: label ? `${groupCode} · ${label}` : groupCode,
      balance: withBalance.reduce((s, w) => s + w.balance, 0), depth: 0, isGroup: true,
    });
    for (const { account, balance } of withBalance) {
      rows.push({ id: account.id, code: account.code, name: account.name, balance, depth: 1, isGroup: false });
    }
  }
  return rows;
}

// Plan comptable complet (actif + inactif), pour l'écran d'administration — contrairement à
// getCashAccountsBalances(), pas filtré aux seuls comptes de trésorerie actifs.
export async function listAccounts() {
  return prisma.ledgerAccount.findMany({ orderBy: { code: 'asc' } });
}

export type CreateAccountParams = {
  code: string;
  name: string;
  type: LedgerAccountType;
  isCashAccount: boolean;
  allowedMethods: PaymentMethod[];
};

export async function createAccount(params: CreateAccountParams) {
  const existing = await prisma.ledgerAccount.findUnique({ where: { code: params.code } });
  if (existing) throw new ConflictError(`Un compte avec le code "${params.code}" existe déjà.`);
  return prisma.ledgerAccount.create({ data: params as Prisma.LedgerAccountCreateInput });
}

export type UpdateAccountParams = {
  name?: string;
  isCashAccount?: boolean;
  allowedMethods?: PaymentMethod[];
  isActive?: boolean;
};

// Le code et le type ne sont jamais modifiables une fois le compte créé : le code est référencé
// en dur (accountCode: '411000', '706000'...) dans invoice.service.ts/expense.service.ts, et le
// type détermine le sens normal du solde (normalBalance ci-dessus) — les changer casserait
// silencieusement la comptabilité déjà posée sur ce compte. Le regroupement hiérarchique
// (getBalanceSheet/getIncomeStatement) est dérivé automatiquement du code (voir
// groupByCodePrefix) — pas de champ parent à gérer ici.
export async function updateAccount(id: string, params: UpdateAccountParams) {
  const account = await prisma.ledgerAccount.findUnique({ where: { id } });
  if (!account) throw new NotFoundError('Compte comptable');
  return prisma.ledgerAccount.update({ where: { id }, data: params as Prisma.LedgerAccountUpdateInput });
}

export type AccountEntriesParams = {
  accountId: string;
  dateFrom?: string;
  dateTo?:   string;
  page:      number;
  limit:     number;
  roleName?: string;
};

// Relevé de compte façon relevé bancaire : une ligne par écriture qui touche ce compte, la plus
// récente en premier.
export async function getAccountEntries(params: AccountEntriesParams) {
  const { accountId, dateFrom, dateTo, page, limit, roleName } = params;
  const skip = (page - 1) * limit;

  if (roleName) {
    const account = await prisma.ledgerAccount.findUnique({ where: { id: accountId }, select: { isCashAccount: true } });
    if (account?.isCashAccount) await assertCanViewCashAccount(roleName, accountId);
  }

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
    by:    ['categoryId'],
    where: hasDateFilter ? { incurredAt: dateFilter } : {},
    _sum:  { amount: true },
  });
  const categories = await prisma.expenseCategory.findMany({
    where: { id: { in: expenseTotals.map(e => e.categoryId) } },
  });
  const categoryNameById = new Map(categories.map(c => [c.id, c.name]));
  const expensesByCategory = expenseTotals.map(e => ({
    categoryId:   e.categoryId,
    categoryName: categoryNameById.get(e.categoryId) ?? '—',
    total:        e._sum.amount ?? 0,
  }));
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

export type BalanceSheetRow = PrefixRow;

// Bilan simplifié à une date donnée : agrégation des soldes par type de compte. Actif = Passif +
// Capitaux propres + résultat cumulé non affecté (produits − charges, jamais "clôturés" vers les
// capitaux propres faute d'exercice comptable formel) — invariant vérifiable via `balanced`.
// Les comptes partageant un préfixe de code sont regroupés sous un en-tête virtuel (voir
// groupByCodePrefix) ; seuls les vrais comptes (`isGroup: false`) entrent dans les totaux, les
// groupes ne sont qu'un cumul d'affichage pour éviter de compter deux fois. Par défaut, un compte
// jamais mouvementé (solde nul) n'apparaît pas — `includeZero` force le plan comptable complet.
export async function getBalanceSheet(asOf?: string, includeZero = false) {
  const dateFilter = asOf ? { lte: new Date(asOf) } : undefined;

  const accounts = await prisma.ledgerAccount.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
  const totals = await prisma.journalLine.groupBy({
    by:    ['accountId'],
    where: dateFilter ? { entry: { date: dateFilter } } : {},
    _sum:  { debit: true, credit: true },
  });
  const totalsByAccountId = new Map(totals.map(t => [t.accountId, t]));

  // Le regroupement (et la détection d'un compte collectif comme "512" Banque, voir
  // buildPrefixTree) se fait sur TOUS les comptes du type, solde nul compris — un compte collectif
  // n'a lui-même quasiment jamais de solde propre, le filtrer avant le regroupement ferait perdre
  // son libellé. Le filtre "solde ≠ 0" s'applique après, ligne par ligne (compte ou groupe).
  const byType = (type: LedgerAccountType): BalanceSheetRow[] => {
    const leaves = accounts.filter(a => a.type === type).map(a => {
      const t   = totalsByAccountId.get(a.id);
      const raw = (t?._sum.debit ?? 0) - (t?._sum.credit ?? 0);
      return { id: a.id, code: a.code, name: a.name, balance: normalBalance(a.type, raw) };
    });
    if (leaves.length === 0) return [];
    const rows = groupByCodePrefix(leaves);
    return includeZero ? rows : rows.filter(r => r.balance !== 0);
  };
  const sumOf = (rows: BalanceSheetRow[]) => rows.filter(r => !r.isGroup).reduce((s, r) => s + r.balance, 0);

  const assets      = byType('ASSET');
  const liabilities = byType('LIABILITY');
  const equity      = byType('EQUITY');

  const totalAssets      = sumOf(assets);
  const totalLiabilities = sumOf(liabilities);
  const netIncomeToDate  = sumOf(byType('REVENUE')) - sumOf(byType('EXPENSE'));
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

export type IncomeStatementRow = { id: string; code: string; name: string; total: number; depth: number; isGroup: boolean };

// Compte de résultat comptable (produits/charges par compte, en partie double) sur une période —
// distinct de getSummary() qui donne une vue trésorerie (encaissé vs facturé) par catégorie métier.
// Même regroupement par préfixe de code que getBalanceSheet (voir groupByCodePrefix) : les
// groupes ne sont qu'un cumul d'affichage, seuls les vrais comptes entrent dans les totaux.
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

  const byType = (type: LedgerAccountType): IncomeStatementRow[] => {
    const leaves = accounts.filter(a => a.type === type).map(a => {
      const t   = totalsByAccountId.get(a.id);
      const raw = (t?._sum.debit ?? 0) - (t?._sum.credit ?? 0);
      return { id: a.id, code: a.code, name: a.name, balance: normalBalance(a.type, raw) };
    }).filter(leaf => leaf.balance !== 0);
    if (leaves.length === 0) return [];
    return groupByCodePrefix(leaves).map(({ id, code, name, balance, depth, isGroup }) => ({ id, code, name, total: balance, depth, isGroup }));
  };
  const sumOf = (rows: IncomeStatementRow[]) => rows.filter(r => !r.isGroup).reduce((s, r) => s + r.total, 0);

  const revenue        = byType('REVENUE');
  const expenses       = byType('EXPENSE');
  const totalRevenue   = sumOf(revenue);
  const totalExpenses  = sumOf(expenses);

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

// ─── Accès trésorerie (écran d'administration) ───────────────────────────────

// État complet pour l'écran Accès trésorerie : la liste des rôles, la liste des comptes de
// trésorerie, et pour chaque rôle ses comptes visibles + drapeaux source/arrivée. `accessAll`
// signale les rôles qui court-circuitent tout (permission ledger.access_all_accounts).
export async function getTreasuryAccessConfig() {
  const [roles, cashAccounts, grants, accessAllLinks] = await Promise.all([
    prisma.role.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.ledgerAccount.findMany({
      where: { isCashAccount: true, isActive: true }, orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    prisma.roleLedgerAccount.findMany({
      select: { roleId: true, accountId: true, canTransferFrom: true, canTransferTo: true, canPayExpenses: true },
    }),
    prisma.rolePermission.findMany({
      where:  { permission: { key: 'ledger.access_all_accounts' } },
      select: { roleId: true },
    }),
  ]);

  return {
    roles,
    cashAccounts,
    grants,
    accessAllRoleIds: accessAllLinks.map(l => l.roleId),
  };
}

export type RoleTreasuryGrant = {
  accountId:       string;
  canTransferFrom: boolean;
  canTransferTo:   boolean;
  canPayExpenses:  boolean;
};

// Remplace intégralement les accès trésorerie d'un rôle (liste blanche + drapeaux). Une ligne
// absente = compte non visible pour ce rôle. Transaction : on efface puis on récrée, jamais d'état
// partiel. Invalide le cache pour que les checks suivants voient la nouvelle config.
export async function setRoleTreasuryAccess(roleId: string, grants: RoleTreasuryGrant[]) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new NotFoundError('Rôle');

  const accountIds = grants.map(g => g.accountId);
  if (accountIds.length > 0) {
    const found = await prisma.ledgerAccount.count({ where: { id: { in: accountIds }, isCashAccount: true } });
    if (found !== new Set(accountIds).size) {
      throw new ConflictError('Un des comptes sélectionnés est inconnu ou n\'est pas un compte de trésorerie.');
    }
  }

  await prisma.$transaction([
    prisma.roleLedgerAccount.deleteMany({ where: { roleId } }),
    prisma.roleLedgerAccount.createMany({
      data: grants.map(g => ({
        roleId,
        accountId:       g.accountId,
        canTransferFrom: g.canTransferFrom,
        canTransferTo:   g.canTransferTo,
        canPayExpenses:  g.canPayExpenses,
      })),
    }),
  ]);

  invalidateTreasuryAccessCache();
  return getTreasuryAccessConfig();
}
