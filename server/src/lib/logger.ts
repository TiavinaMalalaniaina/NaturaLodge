import pino from 'pino';

// JSON en production (consommé par Promtail → Loki, voir monitoring/promtail-config.yml) ;
// pretty-print lisible en dev. Un seul logger partagé — remplace les `console.log`/`console.error`
// sur les chemins qui alimentent le monitoring (requêtes HTTP, erreurs, requêtes Prisma lentes).
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
});
