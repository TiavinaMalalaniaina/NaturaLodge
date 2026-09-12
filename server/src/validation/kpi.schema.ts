import { z } from 'zod';

// Le tableau de bord KPI raisonne toujours par mois calendaire.
export const kpiQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Format attendu : AAAA-MM'),
});

export type KpiQueryParams = z.infer<typeof kpiQuerySchema>;

// targetRate en fraction (0.90 = 90 %), pas en pourcentage — même convention que les autres ratios
// du dashboard (occupancyRate, netOperatingMargin, ...).
export const kpiOccupancyTargetSchema = z.object({
  month:      z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Format attendu : AAAA-MM'),
  targetRate: z.number().min(0).max(1.5),
});

export type KpiOccupancyTargetParams = z.infer<typeof kpiOccupancyTargetSchema>;
