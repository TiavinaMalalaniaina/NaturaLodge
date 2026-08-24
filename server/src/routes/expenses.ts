import { Router, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { expenseListQuerySchema, createExpenseSchema } from '../validation/expense.schema';
import * as expenseService from '../services/expense.service';

export const expensesRouter = Router();
expensesRouter.use(authenticate);

// GET /expenses  ──  liste paginée
expensesRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = expenseListQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await expenseService.list(parsed.data));
}));

// POST /expenses  ──  enregistrer une dépense (réservé ADMIN/MANAGER, voir Phase 0 de la feuille de route)
expensesRouter.post('/', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await expenseService.create(parsed.data, req.user!.id));
}));
