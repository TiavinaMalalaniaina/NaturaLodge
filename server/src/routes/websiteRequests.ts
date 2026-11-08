import express, { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { can } from '../middleware/can';
import { approveSchema, paymentSheetSchema, rejectSchema, requestSchema, staySchema } from '../validation/websiteRequest.schema';
import * as settings from '../services/websiteSettings.service';
import * as proofs from '../services/websiteProof.service';
import * as events from '../services/websiteEvent.service';
import * as push from '../services/staffPush.service';
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
  const { email, next, locale } = z.object({ email: z.string().trim().email('Adresse email invalide').max(254).transform(value => value.toLowerCase()), next: z.enum(['/reservation', '/mes-reservations']).default('/mes-reservations'), locale: z.enum(['fr', 'en']).default('fr') }).parse(req.body);
  const now = Date.now();
  for (const [key, until] of loginLimits) if (until <= now) loginLimits.delete(key);
  if (loginLimits.has(email) || loginLimits.size >= 10000) { res.status(429).json({ error: 'Patientez une minute avant de demander un nouveau lien.' }); return; }
  loginLimits.set(email, now + 60000);
  await auth.requestLogin(email, next, locale);
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
publicRequestsRouter.post('/reservation-requests/:id/cancel', asyncHandler(async (req, res) => {
  auth.checkWebsiteOrigin(req);
  const customer = await auth.currentCustomer(req);
  res.json(await service.cancelByCustomer(req.params.id, customer.id));
}));
// Raw body (the file itself) instead of multipart: no upload library, and the size limit applies before
// anything is buffered beyond it. File name and optional note travel in the query string.
publicRequestsRouter.post('/reservation-requests/:id/proofs', express.raw({ type: [...proofs.PROOF_TYPES], limit: proofs.PROOF_MAX_BYTES }), asyncHandler(async (req, res) => {
  auth.checkWebsiteOrigin(req);
  const customer = await auth.currentCustomer(req);
  const query = z.object({ name: z.string().trim().max(200).default('preuve'), note: z.string().trim().max(200, 'Note trop longue (200 caractères max.)').default('') }).parse(req.query);
  const mimeType = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  res.status(201).json(await proofs.upload(req.params.id, customer.id, { data: req.body, mimeType, fileName: query.name, note: query.note }));
}));
publicRequestsRouter.delete('/reservation-requests/:id/proofs/:proofId', asyncHandler(async (req, res) => {
  auth.checkWebsiteOrigin(req);
  const customer = await auth.currentCustomer(req);
  await proofs.remove(req.params.id, req.params.proofId, customer.id);
  res.status(204).end();
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
  const query = z.object({ status: z.enum(['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED']).optional(), page: z.coerce.number().int().min(1).default(1), search: z.string().trim().max(80).optional() }).parse(req.query);
  res.json(await service.list(query.status, query.page, query.search));
}));
// Push notifications for staff devices (works with the admin closed, via the PWA service worker).
const pushSubscriptionSchema = z.object({ endpoint: z.string().url().max(1000).refine(url => url.startsWith('https://'), 'Endpoint push invalide'), keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }) });
websiteRequestsRouter.get('/push/public-key', can('bookings.view'), (_req, res) => { res.json(push.pushPublicKey()); });
websiteRequestsRouter.post('/push/subscribe', can('bookings.view'), asyncHandler(async (req: AuthRequest, res) => {
  await push.subscribe(req.user!.id, pushSubscriptionSchema.parse(req.body), String(req.headers['user-agent'] ?? ''));
  res.status(204).end();
}));
websiteRequestsRouter.post('/push/unsubscribe', asyncHandler(async (req: AuthRequest, res) => {
  await push.unsubscribe(req.user!.id, z.object({ endpoint: z.string().max(1000) }).parse(req.body).endpoint);
  res.status(204).end();
}));
websiteRequestsRouter.get('/events', can('bookings.view'), asyncHandler(async (req, res) => {
  const { after } = z.object({ after: z.coerce.date().optional() }).parse(req.query);
  res.json(await events.eventsSince(after));
}));
websiteRequestsRouter.get('/payment-sheet', can('bookings.view'), asyncHandler(async (_req, res) => {
  res.json(await settings.paymentSheet());
}));
// Same rights as accepting a request: whoever sends the instructions maintains the payment details.
websiteRequestsRouter.put('/payment-sheet', can('bookings.create'), can('bookings.update_status'), asyncHandler(async (req: AuthRequest, res) => {
  res.json(await settings.savePaymentSheet(paymentSheetSchema.parse(req.body), req.user!.id));
}));
websiteRequestsRouter.get('/:id/proofs/:proofId', can('bookings.view'), asyncHandler(async (req, res) => {
  const proof = await proofs.download(req.params.id, req.params.proofId);
  // Type was checked against the file signature at upload; sandbox + nosniff keep any file inert.
  res.setHeader('Content-Type', proof.mimeType);
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(proof.fileName)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(Buffer.from(proof.data));
}));
websiteRequestsRouter.get('/:id/rooms', can('bookings.view'), asyncHandler(async (req, res) => {
  res.json(await service.roomOptions(req.params.id));
}));
websiteRequestsRouter.post('/:id/approve', can('bookings.create'), can('bookings.update_status'), asyncHandler(async (req: AuthRequest, res) => {
  const data = approveSchema.parse(req.body);
  res.json(await service.approve(req.params.id, data.paymentInstructions, data.hours, data.roomIds, req.user!.id));
}));
websiteRequestsRouter.post('/:id/reject', can('bookings.update_status'), asyncHandler(async (req, res) => {
  await service.reject(req.params.id, rejectSchema.parse(req.body).reason);
  res.status(204).end();
}));
websiteRequestsRouter.post('/:id/confirm', can('bookings.update_status'), can('invoices.record_payment'), asyncHandler(async (req, res) => {
  res.json(await service.confirm(req.params.id));
}));
