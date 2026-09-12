import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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
import { startScheduler } from './lib/scheduler';
import { errorHandler } from './middleware/errorHandler';
import { auditLogger } from './middleware/auditLog';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true }));
app.use(express.json());
// Monté avant les routers : le middleware n'écrit qu'au moment où la réponse se termine
// (`res.on('finish')`), donc `req.user` — posé par `authenticate` plus loin dans la chaîne pour
// chaque router — est déjà disponible à ce moment-là malgré l'ordre de montage.
app.use(auditLogger);

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '2.0.0' }));

app.use('/api/auth', authRouter);
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

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

app.listen(PORT, () => {
  console.log(`🏨 NaturaLodge API running on http://localhost:${PORT}`);
  startScheduler();
});
