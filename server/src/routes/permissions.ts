import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { can } from '../middleware/can';
import { asyncHandler } from '../middleware/asyncHandler';
import { updatePermissionSchema } from '../validation/permission.schema';
import * as permissionService from '../services/permission.service';

export const permissionsRouter = Router();
permissionsRouter.use(authenticate);
permissionsRouter.use(can('permissions.manage'));

// GET /permissions  ──  catalogue complet, chaque permission avec ses rôles actuellement accordés
permissionsRouter.get('/', asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await permissionService.list());
}));

// PATCH /permissions  ──  accorder ou retirer un rôle sur une permission (une case de la matrice)
permissionsRouter.patch('/', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updatePermissionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await permissionService.setRolePermission(parsed.data.permissionId, parsed.data.roleId, parsed.data.granted));
}));
