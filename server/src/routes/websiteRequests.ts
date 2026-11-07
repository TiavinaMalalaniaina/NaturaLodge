import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { can } from '../middleware/can';
import { approveSchema, rejectSchema, requestSchema, staySchema } from '../validation/websiteRequest.schema';
import * as service from '../services/websiteRequest.service';
import * as auth from '../services/websiteAuth.service';
import { prisma } from '../lib/prisma';
import { UnauthorizedError } from '../errors/AppError';

export const publicRequestsRouter = Router();
const requests = new Map<string, { count: number; until: number }>();
publicRequestsRouter.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  const now = Date.now();
  for (const [key, bucket] of requests) if (bucket.until <= now) requests.delete(key);
  const key = req.ip || 'unknown';
  const bucket = requests.get(key) ?? { count: 0, until: now + 60000 };
  if (++bucket.count > 60) { res.status(429).json({ error: 'Trop de requêtes. Réessayez dans une minute.' }); return; }
  if (requests.size < 10000 || requests.has(key)) requests.set(key, bucket);
  next();
});
publicRequestsRouter.get('/room-types', asyncHandler(async (_req, res) => {
  res.json(await service.roomTypes());
}));
publicRequestsRouter.get('/availability', asyncHandler(async (req, res) => {
  const query = staySchema.parse(req.query);
  res.json(await service.availability(query.arrival, query.departure));
}));
const loginLimits = new Map<string, number>();
publicRequestsRouter.post('/auth/email', asyncHandler(async (req, res) => {
  auth.checkWebsiteOrigin(req);
  const { email, next } = z.object({ email: z.string().trim().email('Adresse email invalide').max(254).transform(value => value.toLowerCase()), next: z.enum(['/reservation', '/mes-reservations']).default('/mes-reservations') }).parse(req.body);
  const now = Date.now();
  for (const [key, until] of loginLimits) if (until <= now) loginLimits.delete(key);
  if (loginLimits.has(email) || loginLimits.size >= 10000) { res.status(429).json({ error: 'Patientez une minute avant de demander un nouveau lien.' }); return; }
  loginLimits.set(email, now + 60000);
  await auth.requestLogin(email, next);
  res.json({ message: 'Consultez votre email pour vous connecter. Le lien est valable 15 minutes et utilisable une seule fois.' });
}));
publicRequestsRouter.post('/auth/verify', asyncHandler(async (req, res) => {
  auth.checkWebsiteOrigin(req);
  const { token } = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(req.body);
  res.json(await auth.login(token, req, res));
}));
publicRequestsRouter.get('/auth/me', asyncHandler(async (req, res) => { res.json(await auth.currentCustomer(req)); }));
publicRequestsRouter.post('/auth/logout', asyncHandler(async (req, res) => {
  auth.checkWebsiteOrigin(req);
  await auth.logout(req, res);
  res.json({ success: true });
}));
publicRequestsRouter.post('/reservation-requests', asyncHandler(async (req, res) => {
  auth.checkWebsiteOrigin(req);
  const customer = await auth.currentCustomer(req);
  const key = z.string().regex(/^[a-f0-9]{64}$/).parse(req.headers['idempotency-key']);
  res.status(201).json(await service.submit(requestSchema.parse({ ...req.body, email: customer.email }), key, customer.id));
}));
publicRequestsRouter.get('/reservation-requests', asyncHandler(async (req, res) => {
  const customer = await auth.currentCustomer(req);
  res.json(await service.listForCustomer(customer.id));
}));

export const websiteRequestsRouter = Router();
websiteRequestsRouter.use(authenticate, asyncHandler(async (req: AuthRequest, _res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, include: { role: true } });
  if (!user || user.status === 'INACTIVE') throw new UnauthorizedError('Compte inactif');
  req.user!.role = user.role.name;
  next();
}));
websiteRequestsRouter.get('/pending-count', can('bookings.view'), asyncHandler(async (_req, res) => {
  res.json(await service.pendingCount());
}));
websiteRequestsRouter.get('/', can('bookings.view'), asyncHandler(async (req, res) => {
  const query = z.object({ status: z.enum(['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED']).optional(), page: z.coerce.number().int().min(1).default(1) }).parse(req.query);
  res.json(await service.list(query.status, query.page));
}));
websiteRequestsRouter.post('/:id/approve', can('bookings.create'), can('bookings.update_status'), asyncHandler(async (req: AuthRequest, res) => {
  const data = approveSchema.parse(req.body);
  res.json(await service.approve(req.params.id, data.paymentInstructions, data.hours, req.user!.id));
}));
websiteRequestsRouter.post('/:id/reject', can('bookings.update_status'), asyncHandler(async (req, res) => {
  await service.reject(req.params.id, rejectSchema.parse(req.body).reason);
  res.status(204).end();
}));
websiteRequestsRouter.post('/:id/confirm', can('bookings.update_status'), can('invoices.record_payment'), asyncHandler(async (req, res) => {
  res.json(await service.confirm(req.params.id));
}));
