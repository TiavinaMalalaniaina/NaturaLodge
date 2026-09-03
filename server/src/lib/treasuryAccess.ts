import { prisma } from './prisma';
import { ForbiddenError } from '../errors/AppError';
import { roleHasPermission } from './permissions';

// Accès par rôle aux comptes de TRÉSORERIE (voir modèle RoleLedgerAccount). Cache mémoire
// process-local sur le même modèle que lib/permissions.ts — la config change rarement et seulement
// depuis l'écran Accès trésorerie (ADMIN), qui appelle invalidateTreasuryAccessCache().
//
// Règles (un rôle porteur de `ledger.access_all_accounts` court-circuite tout) :
//  - visibilité : un rôle SANS aucune ligne voit tous les comptes (défaut non-régressif) ; un rôle
//    AVEC des lignes ne voit QUE les comptes listés ;
//  - virement `from → to` : les deux comptes doivent être visibles ; si le rôle a au moins une
//    ligne `canTransferFrom`, la source doit en faire partie (sinon toute source visible convient) —
//    idem `canTransferTo` pour l'arrivée ;
//  - paiement d'une dépense : le compte doit être visible ; si le rôle a au moins une ligne
//    `canPayExpenses`, le compte doit en faire partie (sinon tout compte visible convient).

type RoleAccess = {
  visible:      Set<string>;
  transferFrom: Set<string>;
  transferTo:   Set<string>;
  payExpenses:  Set<string>;
};

let cache: Map<string, RoleAccess> | null = null;
let loading: Promise<Map<string, RoleAccess>> | null = null;

async function loadCache(): Promise<Map<string, RoleAccess>> {
  const rows = await prisma.roleLedgerAccount.findMany({
    select: {
      accountId: true, canTransferFrom: true, canTransferTo: true, canPayExpenses: true,
      role: { select: { name: true } },
    },
  });
  const map = new Map<string, RoleAccess>();
  for (const r of rows) {
    let ra = map.get(r.role.name);
    if (!ra) {
      ra = { visible: new Set(), transferFrom: new Set(), transferTo: new Set(), payExpenses: new Set() };
      map.set(r.role.name, ra);
    }
    ra.visible.add(r.accountId);
    if (r.canTransferFrom) ra.transferFrom.add(r.accountId);
    if (r.canTransferTo)   ra.transferTo.add(r.accountId);
    if (r.canPayExpenses)  ra.payExpenses.add(r.accountId);
  }
  return map;
}

async function getCache(): Promise<Map<string, RoleAccess>> {
  if (cache) return cache;
  if (!loading) {
    loading = loadCache().then(map => { cache = map; loading = null; return map; });
  }
  return loading;
}

export function invalidateTreasuryAccessCache(): void {
  cache = null;
}

export async function canViewCashAccount(roleName: string, accountId: string): Promise<boolean> {
  if (await roleHasPermission(roleName, 'ledger.access_all_accounts')) return true;
  const ra = (await getCache()).get(roleName);
  if (!ra) return true; // rôle non configuré → voit tout
  return ra.visible.has(accountId);
}

export async function assertCanViewCashAccount(roleName: string, accountId: string): Promise<void> {
  if (!(await canViewCashAccount(roleName, accountId))) {
    throw new ForbiddenError("Vous n'avez pas accès à ce compte de trésorerie.");
  }
}

// Prédicat synchrone une fois le cache résolu — pour filtrer une liste de comptes en une passe.
export async function cashAccountVisibilityFilter(roleName: string): Promise<(accountId: string) => boolean> {
  if (await roleHasPermission(roleName, 'ledger.access_all_accounts')) return () => true;
  const ra = (await getCache()).get(roleName);
  if (!ra) return () => true;
  return (accountId: string) => ra.visible.has(accountId);
}

export async function assertCanTransfer(roleName: string, fromAccountId: string, toAccountId: string): Promise<void> {
  await assertCanViewCashAccount(roleName, fromAccountId);
  await assertCanViewCashAccount(roleName, toAccountId);
  if (await roleHasPermission(roleName, 'ledger.access_all_accounts')) return;

  const ra = (await getCache()).get(roleName);
  const fromOk = !ra || ra.transferFrom.size === 0 || ra.transferFrom.has(fromAccountId);
  const toOk   = !ra || ra.transferTo.size === 0   || ra.transferTo.has(toAccountId);
  if (!fromOk) throw new ForbiddenError("Votre rôle ne peut pas émettre de virement depuis ce compte.");
  if (!toOk)   throw new ForbiddenError("Votre rôle ne peut pas émettre de virement vers ce compte.");
}

// Le compte depuis lequel une dépense est payée doit être visible pour le rôle et, si le rôle a
// désigné des comptes « dépenses », en faire partie.
export async function assertCanPayExpenseFrom(roleName: string, accountId: string): Promise<void> {
  await assertCanViewCashAccount(roleName, accountId);
  if (await roleHasPermission(roleName, 'ledger.access_all_accounts')) return;

  const ra = (await getCache()).get(roleName);
  const ok = !ra || ra.payExpenses.size === 0 || ra.payExpenses.has(accountId);
  if (!ok) throw new ForbiddenError("Votre rôle ne peut pas payer de dépense depuis ce compte.");
}
