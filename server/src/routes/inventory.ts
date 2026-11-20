import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { can } from '../middleware/can';
import { asyncHandler } from '../middleware/asyncHandler';
import { roleHasPermission } from '../lib/permissions';
import { ForbiddenError } from '../errors/AppError';
import {
  addInventoryVariantsSchema, recordCountLinesSchema, createInventoryCategorySchema, createInventoryItemSchema, createInventoryMovementSchema,
  inventoryItemListQuerySchema, inventoryMovementListQuerySchema, updateInventoryCategorySchema, updateInventoryItemSchema,
} from '../validation/inventory.schema';
import * as inventoryService from '../services/inventory.service';
import * as movementService from '../services/inventoryMovement.service';
import * as countService from '../services/inventoryCount.service';

export const inventoryRouter = Router();
inventoryRouter.use(authenticate);

// Coûts et valeur masqués sans la permission dédiée.
const canSeeValue = (req: AuthRequest) => roleHasPermission(req.user!.role, 'inventory.view_value');

// ─── Catégories ──────────────────────────────────────────────────

inventoryRouter.get('/categories', can('inventory.view'), asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await inventoryService.listCategories());
}));

inventoryRouter.post('/categories', can('inventory.manage_catalog'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createInventoryCategorySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await inventoryService.createCategory(parsed.data));
}));

inventoryRouter.patch('/categories/:id', can('inventory.manage_catalog'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateInventoryCategorySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await inventoryService.updateCategory(req.params.id, parsed.data));
}));

// ─── Articles et variantes ───────────────────────────────────────

inventoryRouter.get('/items', can('inventory.view'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = inventoryItemListQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await inventoryService.listItems(parsed.data, await canSeeValue(req)));
}));

inventoryRouter.get('/items/:id', can('inventory.view'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await inventoryService.getItem(req.params.id, await canSeeValue(req)));
}));

inventoryRouter.post('/items', can('inventory.manage_catalog'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createInventoryItemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await inventoryService.createItem(parsed.data, req.user!.id, await canSeeValue(req)));
}));

inventoryRouter.patch('/items/:id', can('inventory.manage_catalog'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateInventoryItemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await inventoryService.updateItem(req.params.id, parsed.data, await canSeeValue(req)));
}));

inventoryRouter.post('/items/:id/variants', can('inventory.manage_catalog'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = addInventoryVariantsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await inventoryService.addVariants(req.params.id, parsed.data, req.user!.id, await canSeeValue(req)));
}));

// ─── Mouvements ──────────────────────────────────────────────────

inventoryRouter.get('/movements', can('inventory.view'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = inventoryMovementListQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await movementService.list(parsed.data, await canSeeValue(req)));
}));

// La permission dépend du type de mouvement : consommation et casse pour tout le personnel,
// entrée d'achat pour l'accueil, perte et mise au rebut pour les responsables.
inventoryRouter.post('/movements', can('inventory.view'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createInventoryMovementSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  if (!(await roleHasPermission(req.user!.role, movementService.PERMISSION_BY_TYPE[parsed.data.type]))) {
    throw new ForbiddenError();
  }
  res.status(201).json(await movementService.record(parsed.data, req.user!.id, await canSeeValue(req)));
}));

// ─── Inventaires (comptages) ─────────────────────────────────────
// Tout le personnel compte ; seuls les responsables ouvrent, valident ou annulent.

inventoryRouter.get('/counts', can('inventory.count'), asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await countService.list());
}));

inventoryRouter.post('/counts', can('inventory.validate_count'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(201).json(await countService.open(req.user!.id, await canSeeValue(req)));
}));

inventoryRouter.get('/counts/:id', can('inventory.count'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await countService.get(req.params.id, await canSeeValue(req)));
}));

inventoryRouter.patch('/counts/:id/lines', can('inventory.count'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = recordCountLinesSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await countService.recordLines(req.params.id, parsed.data, req.user!.id, await canSeeValue(req)));
}));

inventoryRouter.post('/counts/:id/validate', can('inventory.validate_count'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await countService.validate(req.params.id, req.user!.id, await canSeeValue(req)));
}));

inventoryRouter.post('/counts/:id/cancel', can('inventory.validate_count'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(await countService.cancel(req.params.id, await canSeeValue(req)));
}));
