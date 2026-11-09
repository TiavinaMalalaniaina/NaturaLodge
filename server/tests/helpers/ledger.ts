import { prisma } from './db';

// Solde d'un compte au sens débit − crédit (positif = débiteur : argent en caisse, créance client…).
export async function balance(accountCode: string): Promise<number> {
  const agg = await prisma.journalLine.aggregate({
    where: { account: { code: accountCode } },
    _sum: { debit: true, credit: true },
  });
  return (agg._sum.debit ?? 0) - (agg._sum.credit ?? 0);
}

// Invariant de la partie double sur tout le grand livre.
export async function totals(): Promise<{ debit: number; credit: number }> {
  const agg = await prisma.journalLine.aggregate({ _sum: { debit: true, credit: true } });
  return { debit: agg._sum.debit ?? 0, credit: agg._sum.credit ?? 0 };
}

export async function accountId(code: string): Promise<string> {
  return (await prisma.ledgerAccount.findUniqueOrThrow({ where: { code } })).id;
}
