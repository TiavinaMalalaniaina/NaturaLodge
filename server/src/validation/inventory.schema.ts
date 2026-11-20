import { z } from 'zod';

const FAMILIES = ['EQUIPMENT', 'LINEN_TABLEWARE', 'CONSUMABLE'] as const;

const name     = z.string().trim().min(1).max(120);
const quantity = z.number().int().positive().max(1_000_000);
const amount   = z.number().int().min(0).max(1_000_000_000);
const reason   = z.string().trim().max(500).default('');
const boolFlag = z.enum(['true', 'false']).transform(v => v === 'true');

// ─── Catégories ──────────────────────────────────────────────────

export const createInventoryCategorySchema = z.object({
  name:   z.string().trim().min(1).max(80),
  family: z.enum(FAMILIES),
});

export const updateInventoryCategorySchema = z.object({
  name:     z.string().trim().min(1).max(80).optional(),
  family:   z.enum(FAMILIES).optional(),
  isActive: z.boolean().optional(),
});

// ─── Articles et variantes ───────────────────────────────────────

export const inventoryItemListQuerySchema = z.object({
  categoryId:      z.string().min(1).optional(),
  family:          z.enum(FAMILIES).optional(),
  search:          z.string().trim().max(120).optional(),
  belowMin:        boolFlag.optional(),
  includeInactive: boolFlag.optional(),
});

export const createInventoryItemSchema = z.object({
  name,
  categoryId:      z.string().min(1),
  unit:            z.string().trim().min(1).max(20).default('pièce'),
  minStock:        amount.nullable().optional(),
  unitCost:        amount.nullable().optional(),
  initialQuantity: z.number().int().min(0).max(1_000_000).default(0),
});

export const updateInventoryItemSchema = z.object({
  name:       name.optional(),
  categoryId: z.string().min(1).optional(),
  unit:       z.string().trim().min(1).max(20).optional(),
  minStock:   amount.nullable().optional(),
  unitCost:   amount.nullable().optional(),
  isActive:   z.boolean().optional(),
});

export const addInventoryVariantsSchema = z.object({
  variants: z.array(z.object({
    name,
    minStock: amount.nullable().optional(),
    unitCost: amount.nullable().optional(),
    quantity: z.number().int().min(0).max(1_000_000).default(0),
  })).min(1).max(50),
});

// ─── Mouvements ──────────────────────────────────────────────────
// Seuls les mouvements saisis à la main : INITIAL et RECLASSIFICATION naissent de la création
// d'un article ou de ses variantes, ADJUSTMENT de la validation d'un inventaire (lot 2).

const base = { itemId: z.string().min(1), quantity, reason };

export const createInventoryMovementSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PURCHASE'),    ...base, unitCost: amount.optional(), expenseId: z.string().min(1).optional() }),
  z.object({ type: z.literal('CONSUMPTION'), ...base }),
  z.object({ type: z.literal('BREAKAGE'),    ...base, bookingId: z.string().min(1).optional() }),
  z.object({ type: z.literal('LOSS'),        ...base, bookingId: z.string().min(1).optional() }),
  z.object({ type: z.literal('DISPOSAL'),    ...base }),
]);

export const inventoryMovementListQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(200).default(30),
  itemId:   z.string().min(1).optional(),
  type:     z.enum(['INITIAL', 'PURCHASE', 'CONSUMPTION', 'BREAKAGE', 'LOSS', 'DISPOSAL', 'ADJUSTMENT', 'RECLASSIFICATION']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo:   z.string().datetime().optional(),
});

// ─── Inventaires (comptages) ─────────────────────────────────────

export const recordCountLinesSchema = z.object({
  lines: z.array(z.object({
    itemId:     z.string().min(1),
    // null efface un comptage saisi par erreur.
    countedQty: z.number().int().min(0).max(1_000_000).nullable(),
    note:       z.string().trim().max(500).optional(),
  })).min(1).max(500),
});

export type RecordCountLinesInput = z.infer<typeof recordCountLinesSchema>;
export type CreateInventoryCategoryInput = z.infer<typeof createInventoryCategorySchema>;
export type UpdateInventoryCategoryInput = z.infer<typeof updateInventoryCategorySchema>;
export type InventoryItemListParams      = z.infer<typeof inventoryItemListQuerySchema>;
export type CreateInventoryItemInput     = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryItemInput     = z.infer<typeof updateInventoryItemSchema>;
export type AddInventoryVariantsInput    = z.infer<typeof addInventoryVariantsSchema>;
export type CreateInventoryMovementInput = z.infer<typeof createInventoryMovementSchema>;
export type InventoryMovementListParams  = z.infer<typeof inventoryMovementListQuerySchema>;
export type ManualMovementType           = CreateInventoryMovementInput['type'];
