import { execSync } from 'node:child_process';
import { Client, Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedChartOfAccounts } from '../prisma/seedChartOfAccounts';
import { seedExpenseCategories } from '../prisma/seedExpenseCategories';
import { seedRoles } from '../prisma/seedRoles';
import { seedPermissions } from '../prisma/seedPermissions';

// Une fois par lancement : base recréée de zéro, migrations appliquées comme en prod
// (`migrate deploy`), puis seulement les données de référence (rôles, permissions, plan comptable).
// Les données métier sont créées par chaque test via tests/helpers/factories.ts.
export default async function setup() {
  const url = new URL(process.env.DATABASE_URL!);
  const dbName = url.pathname.slice(1);

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!exists.rowCount) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  await db.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  await db.end();

  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: process.env });

  const pool = new Pool({ connectionString: url.toString() });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  await seedChartOfAccounts(prisma);
  await seedExpenseCategories(prisma);
  await seedRoles(prisma);
  await seedPermissions(prisma);
  await prisma.$disconnect();
  await pool.end();
}
