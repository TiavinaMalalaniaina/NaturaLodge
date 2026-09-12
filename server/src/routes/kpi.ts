import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { can } from '../middleware/can';
import { asyncHandler } from '../middleware/asyncHandler';
import { kpiQuerySchema, kpiOccupancyTargetSchema } from '../validation/kpi.schema';
import * as kpiService from '../services/kpi.service';

export const kpiRouter = Router();
kpiRouter.use(authenticate);

// GET /kpi?month=AAAA-MM  ──  KPI hôteliers du mois (occupation / facturation / rentabilité),
// calculés par les vues Postgres kpi_*. Même public que les rapports comptables.
kpiRouter.get('/', can('ledger.view_reports'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = kpiQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await kpiService.getHotelKpis({ month: parsed.data.month, detail: parsed.data.detail !== '0' }));
}));

// PUT /kpi/occupancy-target  ──  définit/modifie l'objectif d'occupation d'un mois (ex: prévision
// haute saison), comparé au taux réel dans la réponse GET /kpi ci-dessus.
kpiRouter.put('/occupancy-target', can('kpi.manage_target'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = kpiOccupancyTargetSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  res.json(await kpiService.setOccupancyTarget(parsed.data));
}));
