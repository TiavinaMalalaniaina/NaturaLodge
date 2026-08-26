import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { roleHasPermission } from '../lib/permissions';

// Remplace authorize(...roles) : la liste de rôles autorisés n'est plus codée en dur route par
// route, elle est consultée dans la table RolePermission (voir prisma/seedPermissions.ts pour le
// catalogue et la répartition par rôle actuels — Phase 2 de la feuille de route permissions).
export function can(permissionKey: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }
    const allowed = await roleHasPermission(req.user.role, permissionKey);
    if (!allowed) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }
    next();
  };
}
