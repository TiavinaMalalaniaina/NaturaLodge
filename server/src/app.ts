import { appEnv } from './lib/env';
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { authRouter } from './routes/auth';
import { roomsRouter } from './routes/rooms';
import { roomTypesRouter } from './routes/roomTypes';
import { invoicesRouter } from './routes/invoices';
import { guestsRouter } from './routes/guests';
import { bookingsRouter } from './routes/bookings';
import { staffRouter } from './routes/staff';
import { extrasRouter } from './routes/extras';
import { paymentsRouter } from './routes/payments';
import { ledgerRouter } from './routes/ledger';
import { kpiRouter } from './routes/kpi';
import { expensesRouter } from './routes/expenses';
import { auditLogsRouter } from './routes/auditLogs';
import { permissionsRouter } from './routes/permissions';
import { rolesRouter } from './routes/roles';
import { publicRequestsRouter, websiteRequestsRouter } from './routes/websiteRequests';
import { errorHandler } from './middleware/errorHandler';
import { auditLogger } from './middleware/auditLog';
import { metricsMiddleware, registry } from './middleware/metrics';
import { logger } from './lib/logger';

export const app = express();

// Behind nginx/Docker, req.ip is the proxy's address unless the proxy is trusted; the public
// rate limit would then be shared by every visitor.
const trustProxy = process.env.TRUST_PROXY ?? 'loopback, uniquelocal';
app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'false' ? false : trustProxy);

const allowedOrigins =[process.env.FRONTEND_URL ?? 'http://localhost:3000', process.env.WEBSITE_URL ?? 'http://localhost:4321'];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/metrics' || req.url === '/health' } }));
app.use(metricsMiddleware);
// Monté avant les routers : le middleware n'écrit qu'au moment où la réponse se termine
// (`res.on('finish')`), donc `req.user` — posé par `authenticate` plus loin dans la chaîne pour
// chaque router — est déjà disponible à ce moment-là malgré l'ordre de montage.
app.use(auditLogger);

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '2.3.0', env: appEnv }));

// Scrapé par Prometheus (monitoring/prometheus.yml) via le réseau Docker interne
// (naturalodge-network) — jamais publié sur un port exposé à l'hôte, donc jamais accessible
// depuis l'extérieur de la VPS malgré l'absence d'authentification sur cette route.
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', registry.contentType);
  res.send(await registry.metrics());
});

app.use('/api/auth', authRouter);
app.use('/api/public', publicRequestsRouter);
app.use('/api/website-requests', websiteRequestsRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/room-types', roomTypesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/guests', guestsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/staff', staffRouter);
app.use('/api/extras', extrasRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/ledger', ledgerRouter);
app.use('/api/kpi', kpiRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/permissions', permissionsRouter);
app.use('/api/roles', rolesRouter);

app.use((_req, res) => res.status(404).json({ error: 'Route introuvable' }));

app.use(errorHandler);
