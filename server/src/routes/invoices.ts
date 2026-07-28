import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { invoiceListQuerySchema, generateInvoiceSchema, updateInvoiceSchema, paymentSchema } from '../validation/invoice.schema';
import * as invoiceService from '../services/invoice.service';

export const invoicesRouter = Router();
invoicesRouter.use(authenticate);

// GET /invoices  ──  liste paginée
invoicesRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = invoiceListQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await invoiceService.list(parsed.data));
}));

// GET /invoices/booking/:bookingId  ──  facture d'une réservation
invoicesRouter.get('/booking/:bookingId', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await invoiceService.getByBookingId(req.params.bookingId));
}));

// GET /invoices/:id
invoicesRouter.get('/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await invoiceService.getById(req.params.id));
}));

// POST /invoices/generate  ──  générer depuis une réservation (idempotent)
invoicesRouter.post('/generate', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = generateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { invoice, created } = await invoiceService.generate(parsed.data, req.user!.id);
  res.status(created ? 201 : 200).json(invoice);
}));

// PATCH /invoices/:id  ──  modifier notes / dueAt / taxAmount
invoicesRouter.patch('/:id', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await invoiceService.update(req.params.id, parsed.data));
}));

// POST /invoices/:id/payments  ──  enregistrer un paiement
invoicesRouter.post('/:id/payments', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await invoiceService.addPayment(req.params.id, parsed.data, req.user!.id));
}));

// DELETE /invoices/:id/payments/:paymentId  ──  annuler un paiement
invoicesRouter.delete('/:id/payments/:paymentId', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await invoiceService.voidPayment(req.params.id, req.params.paymentId));
}));
