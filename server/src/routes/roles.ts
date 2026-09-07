import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { can } from '../middleware/can';
import { asyncHandler } from '../middleware/asyncHandler';
import { createRoleSchema, updateRoleSchema } from '../validation/role.schema';
import * as roleService from '../services/role.service';

// Même permission que l'écran Permissions ('permissions.manage', ADMIN) : la gestion des rôles et
// de leurs droits vit sur la même surface d'admin, pas de clé séparée pour un seul écran.
export const rolesRouter = Router();
rolesRouter.use(authenticate);
rolesRouter.use(can('permissions.manage'));

// GET /roles  ──  liste des rôles (avec nombre de comptes staff qui les utilisent)
rolesRouter.get('/', asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await roleService.list());
}));

// POST /roles  ──  créer un rôle custom (démarre sans aucune permission accordée)
rolesRouter.post('/', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createRoleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.status(201).json(await roleService.create(parsed.data));
}));

// PATCH /roles/:id  ──  renommer un rôle (y compris un rôle système)
rolesRouter.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await roleService.update(req.params.id, parsed.data));
}));
