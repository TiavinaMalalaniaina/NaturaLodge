import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { can } from '../middleware/can';
import { asyncHandler } from '../middleware/asyncHandler';
import { auditLogQuerySchema } from '../validation/auditLog.schema';
import * as auditLogService from '../services/auditLog.service';

export const auditLogsRouter = Router();
auditLogsRouter.use(authenticate);
auditLogsRouter.use(can('auditLogs.view'));

// GET /audit-logs  ──  journal de toutes les actions mutantes, réservé ADMIN
auditLogsRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = auditLogQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await auditLogService.list(parsed.data));
}));

// GET /audit-logs/resource-types  ──  valeurs distinctes pour peupler un filtre
auditLogsRouter.get('/resource-types', asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await auditLogService.listResourceTypes());
}));
