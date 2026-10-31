import { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

// Métriques par défaut du process Node (heap, event loop lag, handles actifs, GC) — le premier
// signal de dégradation, souvent visible avant que la latence des requêtes ne bouge.
export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Durée des requêtes HTTP en secondes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: "Nombre total de requêtes HTTP",
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

// Un segment qui ressemble à un id cuid() (ex: "cmt3d7goo0001gkrk1i42nf96") est remplacé par ":id"
// — même logique que middleware/auditLog.ts:parseResource — pour ne pas exploser la cardinalité
// du label `route` avec un identifiant par requête (Prometheus stocke une série temporelle par
// combinaison de labels).
const CUID_PATTERN = /^c[a-z0-9]{20,}$/i;
function normalizeRoute(path: string): string {
  return path.split('?')[0].split('/').map(seg => (CUID_PATTERN.test(seg) ? ':id' : seg)).join('/') || '/';
}

// Mesuré sur `res.on('finish')`, comme auditLogger — n'ajoute aucune latence à la requête réelle
// et capture le statut final même après une redirection interne d'Express.
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const route = normalizeRoute(req.originalUrl);
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);
  });

  next();
}
