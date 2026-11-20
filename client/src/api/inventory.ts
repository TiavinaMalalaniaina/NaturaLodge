import { api } from './client';

export type InventoryFamily = 'equipment' | 'linen_tableware' | 'consumable';
export type InventoryMovementType =
  | 'initial' | 'purchase' | 'consumption' | 'breakage' | 'loss' | 'disposal' | 'adjustment' | 'reclassification';
export type ManualMovementType = 'purchase' | 'consumption' | 'breakage' | 'loss' | 'disposal';

export const INVENTORY_FAMILIES: InventoryFamily[] = ['equipment', 'linen_tableware', 'consumable'];
export const OUTGOING_MOVEMENTS: ManualMovementType[] = ['consumption', 'breakage', 'loss', 'disposal'];

const lower = <T extends string>(v: string) => v.toLowerCase() as T;
const upper = (v: string) => v.toUpperCase();

// ─── Catégories ──────────────────────────────────────────────────

export interface InventoryCategory {
  id:       string;
  name:     string;
  family:   InventoryFamily;
  isActive: boolean;
}

const normalizeCategory = (raw: InventoryCategory): InventoryCategory => ({ ...raw, family: lower<InventoryFamily>(raw.family) });

export const fetchInventoryCategories = async (): Promise<InventoryCategory[]> => {
  const { data } = await api.get<InventoryCategory[]>('/inventory/categories');
  return data.map(normalizeCategory);
};

export interface InventoryCategoryPayload {
  name?:     string;
  family?:   InventoryFamily;
  isActive?: boolean;
}

export const createInventoryCategory = async (payload: Required<Pick<InventoryCategoryPayload, 'name' | 'family'>>): Promise<InventoryCategory> => {
  const { data } = await api.post<InventoryCategory>('/inventory/categories', { ...payload, family: upper(payload.family) });
  return normalizeCategory(data);
};

export const updateInventoryCategory = async (id: string, payload: InventoryCategoryPayload): Promise<InventoryCategory> => {
  const { data } = await api.patch<InventoryCategory>(`/inventory/categories/${id}`, {
    ...payload, ...(payload.family ? { family: upper(payload.family) } : {}),
  });
  return normalizeCategory(data);
};

// ─── Articles et variantes ───────────────────────────────────────

export interface InventoryVariant {
  id:          string;
  parentId:    string;
  name:        string;
  displayName: string;
  quantity:    number;
  minStock:    number | null;
  /** null sans la permission inventory.view_value */
  unitCost:    number | null;
  isActive:    boolean;
  isBelowMin:  boolean;
}

export interface InventoryItem {
  id:          string;
  name:        string;
  displayName: string;
  category:    { id: string; name: string; family: InventoryFamily };
  unit:        string;
  /** Total pour l'hôtel : la somme des variantes actives pour un article qui en a. */
  quantity:    number;
  minStock:    number | null;
  unitCost:    number | null;
  value:       number | null;
  isActive:    boolean;
  hasVariants: boolean;
  isBelowMin:  boolean;
  hasVariantBelowMin: boolean;
  variants:    InventoryVariant[];
}

const normalizeItem = (raw: InventoryItem): InventoryItem => ({
  ...raw, category: { ...raw.category, family: lower<InventoryFamily>(raw.category.family) },
});

export interface InventoryItemsParams {
  categoryId?:      string;
  family?:          InventoryFamily;
  search?:          string;
  belowMin?:        boolean;
  includeInactive?: boolean;
}

export const fetchInventoryItems = async (params: InventoryItemsParams = {}): Promise<InventoryItem[]> => {
  const { data } = await api.get<InventoryItem[]>('/inventory/items', {
    params: {
      ...params,
      family:          params.family ? upper(params.family) : undefined,
      belowMin:        params.belowMin ? 'true' : undefined,
      includeInactive: params.includeInactive ? 'true' : undefined,
    },
  });
  return data.map(normalizeItem);
};

export interface CreateInventoryItemPayload {
  name:             string;
  categoryId:       string;
  unit:             string;
  minStock?:        number | null;
  unitCost?:        number | null;
  initialQuantity?: number;
}

export const createInventoryItem = async (payload: CreateInventoryItemPayload): Promise<InventoryItem> => {
  const { data } = await api.post<InventoryItem>('/inventory/items', payload);
  return normalizeItem(data);
};

export interface UpdateInventoryItemPayload {
  name?:       string;
  categoryId?: string;
  unit?:       string;
  minStock?:   number | null;
  unitCost?:   number | null;
  isActive?:   boolean;
}

export const updateInventoryItem = async (id: string, payload: UpdateInventoryItemPayload): Promise<InventoryItem> => {
  const { data } = await api.patch<InventoryItem>(`/inventory/items/${id}`, payload);
  return normalizeItem(data);
};

export interface NewVariantPayload {
  name:      string;
  quantity:  number;
  minStock?: number | null;
  unitCost?: number | null;
}

export const addInventoryVariants = async (itemId: string, variants: NewVariantPayload[]): Promise<InventoryItem> => {
  const { data } = await api.post<InventoryItem>(`/inventory/items/${itemId}/variants`, { variants });
  return normalizeItem(data);
};

// ─── Mouvements ──────────────────────────────────────────────────

export interface InventoryMovement {
  id:            string;
  type:          InventoryMovementType;
  delta:         number;
  quantityAfter: number;
  unitCost:      number | null;
  reason:        string;
  createdAt:     string;
  item:          { id: string; name: string; unit: string };
  createdBy:     { id: string; name: string } | null;
  expense:       { id: string; description: string } | null;
  booking:       { id: string; guestName: string } | null;
  count:         { id: string; number: string } | null;
}

const normalizeMovement = (raw: InventoryMovement): InventoryMovement => ({ ...raw, type: lower<InventoryMovementType>(raw.type) });

export interface InventoryMovementsParams {
  page?:     number;
  limit?:    number;
  itemId?:   string;
  type?:     InventoryMovementType;
  dateFrom?: string;
  dateTo?:   string;
}

export interface InventoryMovementsList {
  data: InventoryMovement[];
  meta: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean };
}

export const fetchInventoryMovements = async (params: InventoryMovementsParams = {}): Promise<InventoryMovementsList> => {
  const { data } = await api.get<InventoryMovementsList>('/inventory/movements', {
    params: { ...params, type: params.type ? upper(params.type) : undefined },
  });
  return { data: data.data.map(normalizeMovement), meta: data.meta };
};

export interface RecordInventoryMovementPayload {
  type:       ManualMovementType;
  itemId:     string;
  quantity:   number;
  reason?:    string;
  unitCost?:  number;
  bookingId?: string;
}

export const recordInventoryMovement = async (payload: RecordInventoryMovementPayload): Promise<InventoryMovement> => {
  const { data } = await api.post<InventoryMovement>('/inventory/movements', { ...payload, type: upper(payload.type) });
  return normalizeMovement(data);
};

// ─── Inventaires (comptages) ─────────────────────────────────────

export type InventoryCountStatus = 'in_progress' | 'validated' | 'cancelled';

interface Person { id: string; name: string }

export interface InventoryCountSummary {
  id:           string;
  number:       string;
  status:       InventoryCountStatus;
  createdBy:    Person | null;
  validatedBy:  Person | null;
  createdAt:    string;
  validatedAt:  string | null;
  cancelledAt:  string | null;
  totalLines:   number;
  countedLines: number;
  gapLines:     number;
}

export interface InventoryCountLine {
  id:              string;
  itemId:          string;
  name:            string;
  parentId:        string | null;
  parentName:      string | null;
  variantName:     string | null;
  category:        { id: string; name: string };
  unit:            string;
  /** Quantité théorique à l'ouverture. */
  expectedQty:     number;
  /** Quantité théorique actuelle (en cours) ou au moment de la validation. */
  currentQty:      number | null;
  countedQty:      number | null;
  countedBy:       Person | null;
  countedAt:       string | null;
  note:            string;
  /** L'article a bougé après avoir été compté : recompter. */
  movedSinceCount: boolean;
  /** Ligne comptée mais sans effet (article désactivé ou devenu parent). */
  ignored:         boolean;
  gap:             number | null;
  gapValue:        number | null;
}

export interface InventoryCountDetail extends InventoryCountSummary {
  gapValue: number | null;
  lines:    InventoryCountLine[];
}

const normalizeCount = <T extends InventoryCountSummary>(raw: T): T => ({ ...raw, status: lower<InventoryCountStatus>(raw.status) });

export const fetchInventoryCounts = async (): Promise<InventoryCountSummary[]> => {
  const { data } = await api.get<InventoryCountSummary[]>('/inventory/counts');
  return data.map(normalizeCount);
};

export const fetchInventoryCount = async (id: string): Promise<InventoryCountDetail> => {
  const { data } = await api.get<InventoryCountDetail>(`/inventory/counts/${id}`);
  return normalizeCount(data);
};

export const openInventoryCount = async (): Promise<InventoryCountDetail> => {
  const { data } = await api.post<InventoryCountDetail>('/inventory/counts');
  return normalizeCount(data);
};

export interface CountLinePayload { itemId: string; countedQty: number | null; note?: string }

export const recordInventoryCountLines = async (id: string, lines: CountLinePayload[]): Promise<InventoryCountDetail> => {
  const { data } = await api.patch<InventoryCountDetail>(`/inventory/counts/${id}/lines`, { lines });
  return normalizeCount(data);
};

export const validateInventoryCount = async (id: string): Promise<InventoryCountDetail> => {
  const { data } = await api.post<InventoryCountDetail>(`/inventory/counts/${id}/validate`);
  return normalizeCount(data);
};

export const cancelInventoryCount = async (id: string): Promise<InventoryCountDetail> => {
  const { data } = await api.post<InventoryCountDetail>(`/inventory/counts/${id}/cancel`);
  return normalizeCount(data);
};
