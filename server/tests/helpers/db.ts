import { prisma } from '../../src/lib/prisma';

// Données de référence posées une fois par tests/globalSetup.ts — elles ne pointent que les unes
// vers les autres, donc le TRUNCATE ... CASCADE des tables métier ne les atteint jamais.
const REFERENCE_TABLES = new Set([
  '_prisma_migrations',
  'Role',
  'Permission',
  'RolePermission',
  'LedgerAccount',
  'RoleLedgerAccount',
  'ExpenseCategory',
]);

let businessTables: string[] | null = null;

// TRUNCATE coûte par table touchée : on ne vide que celles qui contiennent des lignes (un test en
// remplit typiquement une poignée sur la cinquantaine), repérées en une seule requête.
export async function resetDb(): Promise<void> {
  businessTables ??= (await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)
    .map(r => r.tablename)
    .filter(t => !REFERENCE_TABLES.has(t));
  if (!businessTables.length) return;

  const probe = businessTables.map(t => `SELECT '${t}' AS t WHERE EXISTS (SELECT 1 FROM "public"."${t}")`).join(' UNION ALL ');
  const dirty = (await prisma.$queryRawUnsafe<{ t: string }[]>(probe)).map(r => `"public"."${r.t}"`);
  if (dirty.length) await prisma.$executeRawUnsafe(`TRUNCATE ${dirty.join(', ')} RESTART IDENTITY CASCADE`);
}

export { prisma };
