import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  ledgerEntriesQuerySchema, ledgerSummaryQuerySchema, transferSchema, contributionSchema,
  balanceSheetQuerySchema, exportQuerySchema,
} from '../validation/ledger.schema';
import * as ledgerService from '../services/ledger.service';

export const ledgerRouter = Router();
ledgerRouter.use(authenticate);

// GET /ledger/cash-accounts  ──  comptes de trésorerie + solde courant (choix du compte au
// moment d'un paiement, tableau de bord "où est l'argent")
ledgerRouter.get('/cash-accounts', asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await ledgerService.getCashAccountsBalances());
}));

// GET /ledger/entries  ──  relevé d'un compte (façon relevé bancaire), réservé ADMIN/MANAGER
ledgerRouter.get('/entries', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = ledgerEntriesQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await ledgerService.getAccountEntries(parsed.data));
}));

// GET /ledger/summary  ──  revenu facturé/encaissé + dépenses par catégorie sur une période
ledgerRouter.get('/summary', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = ledgerSummaryQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await ledgerService.getSummary(parsed.data));
}));

// POST /ledger/transfer  ──  virement entre deux comptes de trésorerie, réservé ADMIN/MANAGER
ledgerRouter.post('/transfer', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await ledgerService.transfer({ ...parsed.data, performedById: req.user!.id }));
}));

// POST /ledger/contributions  ──  apport externe (propriétaire...) sur un compte de trésorerie
ledgerRouter.post('/contributions', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = contributionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await ledgerService.recordContribution({ ...parsed.data, performedById: req.user!.id }));
}));

// GET /ledger/balance-sheet  ──  bilan simplifié (actif/passif) à une date donnée
ledgerRouter.get('/balance-sheet', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = balanceSheetQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await ledgerService.getBalanceSheet(parsed.data.asOf));
}));

// GET /ledger/income-statement  ──  compte de résultat (produits/charges) sur une période
ledgerRouter.get('/income-statement', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = ledgerSummaryQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await ledgerService.getIncomeStatement(parsed.data));
}));

// GET /ledger/export  ──  grand livre en CSV, pour transmission à un expert-comptable
ledgerRouter.get('/export', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = exportQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const csv = await ledgerService.exportEntriesCsv(parsed.data);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="grand-livre.csv"');
  res.send(csv);
}));
