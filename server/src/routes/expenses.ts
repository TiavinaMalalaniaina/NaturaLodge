import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { can } from '../middleware/can';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  expenseListQuerySchema, createExpenseSchema, createExpenseCategorySchema, updateExpenseCategorySchema,
} from '../validation/expense.schema';
import * as expenseService from '../services/expense.service';

export const expensesRouter = Router();
expensesRouter.use(authenticate);

// GET /expenses/categories  ──  catégories disponibles (actives + inactives, pour l'admin)
expensesRouter.get('/categories', can('expenses.view'), asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await expenseService.listCategories());
}));

// POST /expenses/categories  ──  créer une catégorie de dépense
expensesRouter.post('/categories', can('expenses.manage_categories'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createExpenseCategorySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await expenseService.createCategory(parsed.data));
}));

// PATCH /expenses/categories/:id  ──  renommer / réassigner le compte / activer / désactiver
expensesRouter.patch('/categories/:id', can('expenses.manage_categories'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateExpenseCategorySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await expenseService.updateCategory(req.params.id, parsed.data));
}));

// GET /expenses  ──  liste paginée
expensesRouter.get('/', can('expenses.view'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = expenseListQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await expenseService.list(parsed.data));
}));

// POST /expenses  ──  enregistrer une dépense
expensesRouter.post('/', can('expenses.create'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await expenseService.create(parsed.data, req.user!.id, req.user!.role));
}));
