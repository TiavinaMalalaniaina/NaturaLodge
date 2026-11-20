import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchInventoryCategories, createInventoryCategory, updateInventoryCategory, InventoryCategoryPayload,
  fetchInventoryItems, createInventoryItem, updateInventoryItem, addInventoryVariants,
  InventoryItemsParams, UpdateInventoryItemPayload, NewVariantPayload,
  fetchInventoryMovements, recordInventoryMovement, InventoryMovementsParams,
  fetchInventoryCounts, fetchInventoryCount, openInventoryCount, recordInventoryCountLines,
  validateInventoryCount, cancelInventoryCount, CountLinePayload, InventoryCountDetail,
} from '../api/inventory';

export const INVENTORY_KEY = ['inventory'] as const;
const CATEGORIES_KEY = [...INVENTORY_KEY, 'categories'] as const;
const ITEMS_KEY      = [...INVENTORY_KEY, 'items'] as const;
const MOVEMENTS_KEY  = [...INVENTORY_KEY, 'movements'] as const;
const COUNTS_KEY     = [...INVENTORY_KEY, 'counts'] as const;

export function useInventoryCategories() {
  return useQuery({ queryKey: CATEGORIES_KEY, queryFn: fetchInventoryCategories });
}

export function useCreateInventoryCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createInventoryCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}

export function useUpdateInventoryCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: InventoryCategoryPayload }) => updateInventoryCategory(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
      qc.invalidateQueries({ queryKey: ITEMS_KEY });
    },
  });
}

export function useInventoryItems(params: InventoryItemsParams = {}) {
  return useQuery({
    queryKey: [...ITEMS_KEY, params],
    queryFn:  () => fetchInventoryItems(params),
    placeholderData: (prev) => prev,
  });
}

// Toute écriture sur un article peut changer quantités, seuils et journal : tout l'inventaire est invalidé.
function useInventoryMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ITEMS_KEY });
      qc.invalidateQueries({ queryKey: MOVEMENTS_KEY });
    },
  });
}

export function useCreateInventoryItem() {
  return useInventoryMutation(createInventoryItem);
}

export function useUpdateInventoryItem() {
  return useInventoryMutation(({ id, payload }: { id: string; payload: UpdateInventoryItemPayload }) => updateInventoryItem(id, payload));
}

export function useAddInventoryVariants() {
  return useInventoryMutation(({ itemId, variants }: { itemId: string; variants: NewVariantPayload[] }) => addInventoryVariants(itemId, variants));
}

export function useRecordInventoryMovement() {
  return useInventoryMutation(recordInventoryMovement);
}

export function useInventoryMovements(params: InventoryMovementsParams, enabled = true) {
  return useQuery({
    queryKey: [...MOVEMENTS_KEY, params],
    queryFn:  () => fetchInventoryMovements(params),
    placeholderData: (prev) => prev,
    enabled,
  });
}

// ─── Inventaires (comptages) ─────────────────────────────────────

export function useInventoryCounts(enabled = true) {
  return useQuery({ queryKey: COUNTS_KEY, queryFn: fetchInventoryCounts, enabled });
}

// Plusieurs personnes comptent en même temps : un inventaire en cours se rafraîchit seul.
export function useInventoryCount(id: string) {
  return useQuery({
    queryKey: [...COUNTS_KEY, id],
    queryFn:  () => fetchInventoryCount(id),
    refetchInterval: (query) => (query.state.data?.status === 'in_progress' ? 15_000 : false),
  });
}

function useCountMutation<TArgs>(mutationFn: (args: TArgs) => Promise<InventoryCountDetail>, affectsStock: boolean) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (count) => {
      qc.setQueryData([...COUNTS_KEY, count.id], count);
      qc.invalidateQueries({ queryKey: COUNTS_KEY, exact: true });
      if (affectsStock) {
        qc.invalidateQueries({ queryKey: ITEMS_KEY });
        qc.invalidateQueries({ queryKey: MOVEMENTS_KEY });
      }
    },
  });
}

export function useOpenInventoryCount() {
  return useCountMutation(openInventoryCount, false);
}

export function useRecordCountLines() {
  return useCountMutation(({ id, lines }: { id: string; lines: CountLinePayload[] }) => recordInventoryCountLines(id, lines), false);
}

export function useValidateInventoryCount() {
  return useCountMutation(validateInventoryCount, true);
}

export function useCancelInventoryCount() {
  return useCountMutation(cancelInventoryCount, false);
}
