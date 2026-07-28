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
import { startScheduler } from './lib/scheduler';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '0.0.2' }));

app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/room-types', roomTypesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/guests', guestsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/staff', staffRouter);

app.use((_req, res) => res.status(404).json({ error: 'Route introuvable' }));

app.use(errorHandler);

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

app.listen(PORT, () => {
  console.log(`🏨 NaturaLodge API running on http://localhost:${PORT}`);
  startScheduler();
});
