import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { can } from '../middleware/can';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  invoiceListQuerySchema, generateInvoiceSchema, updateInvoiceSchema, paymentSchema,
  createDepositSchema, cancelInvoiceSchema,
  invoiceItemSchema, updateInvoiceItemSchema, invoiceDiscountSchema,
} from '../validation/invoice.schema';
import * as invoiceService from '../services/invoice.service';

export const invoicesRouter = Router();
invoicesRouter.use(authenticate);

// GET /invoices  ──  liste paginée
invoicesRouter.get('/', can('invoices.view'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = invoiceListQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await invoiceService.list(parsed.data));
}));

// GET /invoices/booking/:bookingId  ──  facture d'une réservation
invoicesRouter.get('/booking/:bookingId', can('invoices.view'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await invoiceService.getByBookingId(req.params.bookingId));
}));

// GET /invoices/deposits/outstanding  ──  acomptes visés pas encore absorbés par une facture
// définitive — sert à tracer le solde du compte 419100 au bilan. Déclarée avant GET /:id, sinon
// Express matcherait "deposits" comme un id de facture.
invoicesRouter.get('/deposits/outstanding', can('ledger.view_reports'), asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await invoiceService.getOutstandingDeposits());
}));

// GET /invoices/:id
invoicesRouter.get('/:id', can('invoices.view'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await invoiceService.getById(req.params.id));
}));

// POST /invoices/generate  ──  générer (ou resynchroniser) le brouillon de facture d'une réservation
invoicesRouter.post('/generate', can('invoices.generate'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = generateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const { invoice, created } = await invoiceService.generate(parsed.data, req.user!.id);
  res.status(created ? 201 : 200).json(invoice);
}));

// POST /invoices/deposit  ──  créer le brouillon d'une facture d'acompte pour une réservation
invoicesRouter.post('/deposit', can('invoices.issue_deposit'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createDepositSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await invoiceService.createDeposit(parsed.data.bookingId, parsed.data.amount, parsed.data.notes, req.user!.id));
}));

// POST /invoices/:id/validate  ──  viser un brouillon (numéro assigné, posté au grand livre, figé)
invoicesRouter.post('/:id/validate', can('invoices.validate'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await invoiceService.validateInvoice(req.params.id, req.user!.id));
}));

// PATCH /invoices/:id  ──  modifier notes / dueAt / taxAmount
invoicesRouter.patch('/:id', can('invoices.update'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await invoiceService.update(req.params.id, parsed.data));
}));

// POST /invoices/:id/cancel  ──  brouillon jamais visé : supprimé. Facture visée : émet un avoir
// en brouillon (taux de remboursement par défaut, overridable dans le corps de la requête).
invoicesRouter.post('/:id/cancel', can('invoices.cancel'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = cancelInvoiceSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await invoiceService.cancelInvoice(req.params.id, req.user!.id, undefined, parsed.data.refundRatePercent));
}));

// DELETE /invoices/:id  ──  supprimer un brouillon jamais visé (aucun impact comptable). Une
// facture visée ne peut pas être supprimée ici — elle s'annule via POST /:id/cancel (avoir).
invoicesRouter.delete('/:id', can('invoices.delete_draft'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  await invoiceService.deleteDraftInvoice(req.params.id);
  res.status(204).send();
}));

// POST /invoices/:id/items  ──  ajouter une ligne personnalisée (dépense flexible)
invoicesRouter.post('/:id/items', can('invoices.update'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = invoiceItemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await invoiceService.addManualItem(req.params.id, parsed.data, req.user!.id));
}));

// POST /invoices/:id/discounts  ──  appliquer une remise (montant fixe ou pourcentage)
invoicesRouter.post('/:id/discounts', can('invoices.update'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = invoiceDiscountSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await invoiceService.addDiscount(req.params.id, parsed.data, req.user!.id));
}));

// PATCH /invoices/:id/items/:itemId  ──  modifier une ligne personnalisée
invoicesRouter.patch('/:id/items/:itemId', can('invoices.update'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateInvoiceItemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await invoiceService.updateManualItem(req.params.id, req.params.itemId, parsed.data, req.user!.id));
}));

// DELETE /invoices/:id/items/:itemId  ──  retirer une ligne personnalisée
invoicesRouter.delete('/:id/items/:itemId', can('invoices.update'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await invoiceService.removeManualItem(req.params.id, req.params.itemId, req.user!.id));
}));

// POST /invoices/:id/payments  ──  enregistrer un paiement
invoicesRouter.post('/:id/payments', can('invoices.record_payment'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await invoiceService.addPayment(req.params.id, parsed.data, req.user!.id, req.user!.role));
}));

// DELETE /invoices/:id/payments/:paymentId  ──  annuler un paiement
invoicesRouter.delete('/:id/payments/:paymentId', can('invoices.void_payment'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await invoiceService.voidPayment(req.params.id, req.params.paymentId, req.user!.id));
}));
