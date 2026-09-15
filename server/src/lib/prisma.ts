import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Requête lente = symptôme le plus direct d'un problème de perf DB (index manquant, verrou,
// N+1 caché derrière une vue KPI…) — seuil arbitraire, ajustable via env sans redéploiement.
const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_THRESHOLD_MS ?? 200);

function createPrisma() {
  const sslDisabled = process.env.DATABASE_SSL === 'false' || process.env.DATABASE_URL?.includes('localhost');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({
    adapter,
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'stdout', level: 'error' },
    ],
  });

  client.$on('query' as never, (e: { query: string; duration: number; params: string }) => {
    if (e.duration >= SLOW_QUERY_MS) {
      logger.warn({ durationMs: e.duration, query: e.query, params: e.params }, 'slow_prisma_query');
    }
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
