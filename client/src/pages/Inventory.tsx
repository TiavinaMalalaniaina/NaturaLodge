import React, { useState } from 'react';
import { Package, Plus, Settings2, ChevronRight, Pencil, Layers, History, ClipboardList, PackagePlus, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { useInventoryItems, useInventoryCategories, useInventoryMovements } from '../hooks/useInventory';
import { INVENTORY_FAMILIES, InventoryFamily, InventoryItem, InventoryMovementType, InventoryVariant } from '../api/inventory';
import { PageLoader, PageError } from '../components/QueryLoader';
import { formatCurrency, formatDateTime } from '../lib/format';
import { InventoryCategoryManagerModal } from '../components/inventory/InventoryCategoryManagerModal';
import { InventoryItemModal, InventoryItemEditTarget } from '../components/inventory/InventoryItemModal';
import { InventoryVariantsModal } from '../components/inventory/InventoryVariantsModal';
import { InventoryMovementModal } from '../components/inventory/InventoryMovementModal';
import { InventoryCountsTab } from '../components/inventory/InventoryCountsTab';

type Tab = 'items' | 'movements' | 'counts';
const TABS: Tab[] = ['items', 'movements', 'counts'];
const MOVEMENT_TYPES: InventoryMovementType[] = ['initial', 'purchase', 'consumption', 'breakage', 'loss', 'disposal', 'adjustment', 'reclassification'];

const CHIP = 'px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all';
const CHIP_ON = 'bg-primary text-white border-primary shadow-sm';
const CHIP_OFF = 'bg-white text-on-surface-variant border-stone-200 hover:border-primary/30';
const ICON_BUTTON = 'p-2 rounded-lg text-on-surface-variant/60 hover:text-primary hover:bg-stone-50 transition-colors';

export const Inventory: React.FC = () => {
  const { t } = useTranslation();
  const { can } = useAuth();
  const canManage = can('inventory.manage_catalog');
  const canReport = can('inventory.record_usage') || can('inventory.dispose');
  const canReceive = can('inventory.receive');
  const canSeeValue = can('inventory.view_value');

  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (TABS as string[]).includes(searchParams.get('tab') ?? '') ? searchParams.get('tab') as Tab : 'items');
  const visibleTabs = TABS.filter(key => key !== 'counts' || can('inventory.count'));

  // Filtres des articles
  const [family, setFamily]                 = useState<InventoryFamily | 'all'>('all');
  const [categoryId, setCategoryId]         = useState('');
  const [search, setSearch]                 = useState('');
  const [toBuy, setToBuy]                   = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [expanded, setExpanded]             = useState<Set<string>>(new Set());
  const debouncedSearch = useDebounce(search);

  // Filtres du journal
  const [movementItem, setMovementItem] = useState<{ id: string; name: string } | null>(null);
  const [movementType, setMovementType] = useState<InventoryMovementType | ''>('');
  const [page, setPage]                 = useState(1);

  // Fenêtres
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [itemModal, setItemModal]           = useState<{ open: boolean; target: InventoryItemEditTarget | null }>({ open: false, target: null });
  const [variantsFor, setVariantsFor]       = useState<InventoryItem | null>(null);
  const [movementModal, setMovementModal]   = useState<{ open: boolean; mode: 'report' | 'receive'; itemId: string | null }>({ open: false, mode: 'report', itemId: null });

  const { data: categories = [] } = useInventoryCategories();
  const itemsQuery = useInventoryItems({
    family:     family === 'all' ? undefined : family,
    categoryId: categoryId || undefined,
    search:     debouncedSearch.trim() || undefined,
    belowMin:   toBuy,
    includeInactive,
  });
  const movementsQuery = useInventoryMovements(
    { page, limit: 30, itemId: movementItem?.id, type: movementType || undefined },
    tab === 'movements',
  );

  if (itemsQuery.isLoading) return <PageLoader />;
  if (itemsQuery.isError)   return <PageError />;

  const items = itemsQuery.data ?? [];
  const totalValue = items.reduce((sum, i) => sum + (i.value ?? 0), 0);
  const isExpanded = (id: string) => toBuy || expanded.has(id);
  const toggle = (id: string) => setExpanded(s => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const openHistory = (id: string, name: string) => { setMovementItem({ id, name }); setMovementType(''); setPage(1); setTab('movements'); };
  const openReport = (itemId: string | null) => setMovementModal({ open: true, mode: 'report', itemId });
  const editItem = (item: InventoryItem) => setItemModal({ open: true, target: {
    id: item.id, name: item.name, displayName: item.displayName, isVariant: false, categoryId: item.category.id,
    unit: item.unit, minStock: item.minStock, unitCost: item.unitCost, isActive: item.isActive,
  } });
  const editVariant = (item: InventoryItem, v: InventoryVariant) => setItemModal({ open: true, target: {
    id: v.id, name: v.name, displayName: v.displayName, isVariant: true, categoryId: item.category.id,
    unit: item.unit, minStock: v.minStock, unitCost: v.unitCost, isActive: v.isActive,
  } });

  const badges = (belowMin: boolean, isActive: boolean) => (
    <>
      {belowMin && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold uppercase tracking-widest">{t('inventory.badges.belowMin')}</span>}
      {!isActive && <span className="px-2 py-0.5 rounded-full bg-stone-100 text-on-surface-variant/60 text-[9px] font-bold uppercase tracking-widest">{t('inventory.badges.inactive')}</span>}
    </>
  );

  const quantityCell = (quantity: number, unit: string, minStock: number | null) => (
    <div className="text-right shrink-0">
      <p className="text-lg font-bold text-on-surface leading-none tabular-nums">{quantity}<span className="text-xs font-medium text-on-surface-variant/60 ml-1">{unit}</span></p>
      {minStock != null && <p className="text-[10px] text-on-surface-variant/50 mt-1">{t('inventory.minStockShort', { count: minStock })}</p>}
    </div>
  );

  return (
    <div className="space-y-8 pb-24 sm:pb-0">

      {/* ── En-tête ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h2 className="font-display italic text-3xl md:text-4xl text-primary leading-none">{t('inventory.title')}</h2>
          <p className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-[0.2em] mt-2">
            {t('inventory.count', { count: items.length })}
            {canSeeValue && <> · {t('inventory.totalValue', { value: formatCurrency(totalValue) })}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canManage && (
            <button onClick={() => setCategoriesOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-stone-200 text-on-surface rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-primary/30 transition-all">
              <Settings2 className="w-4 h-4" /> {t('inventory.actions.categories')}
            </button>
          )}
          {canManage && (
            <button onClick={() => setItemModal({ open: true, target: null })}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-stone-200 text-on-surface rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-primary/30 transition-all">
              <Plus className="w-4 h-4" /> {t('inventory.actions.newItem')}
            </button>
          )}
          {canReceive && (
            <button onClick={() => setMovementModal({ open: true, mode: 'receive', itemId: null })}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-stone-200 text-on-surface rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-primary/30 transition-all">
              <PackagePlus className="w-4 h-4" /> {t('inventory.actions.receive')}
            </button>
          )}
          {canReport && (
            <button onClick={() => openReport(null)}
              className="hidden sm:flex items-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-black/10">
              <ClipboardList className="w-4 h-4" /> {t('inventory.actions.report')}
            </button>
          )}
        </div>
      </div>

      {/* ── Onglets ── */}
      <div role="tablist" aria-label={t('inventory.title')} className="flex gap-2 border-b border-stone-200">
        {visibleTabs.map(key => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn('px-4 py-3 text-[11px] font-bold uppercase tracking-widest border-b-2 -mb-px transition-colors',
              tab === key ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant/60 hover:text-on-surface')}>
            {t(`inventory.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <>
          {/* ── Filtres ── */}
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setFamily('all')} className={cn(CHIP, family === 'all' ? CHIP_ON : CHIP_OFF)}>{t('common.all')}</button>
              {INVENTORY_FAMILIES.map(f => (
                <button key={f} onClick={() => setFamily(f)} className={cn(CHIP, family === f ? CHIP_ON : CHIP_OFF)}>{t(`inventory.families.${f}`)}</button>
              ))}
              <button onClick={() => setToBuy(v => !v)} aria-pressed={toBuy}
                className={cn(CHIP, toBuy ? 'bg-amber-600 text-white border-amber-600' : CHIP_OFF)}>
                {t('inventory.toBuy')}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[14rem]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                <input type="search" value={search} onChange={e => setSearch(e.target.value)} aria-label={t('common.search')}
                  placeholder={t('inventory.searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} aria-label={t('inventory.columns.category')}
                className="px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                <option value="">{t('inventory.allCategories')}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {canManage && (
                <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer">
                  <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} className="accent-primary" />
                  {t('inventory.showInactive')}
                </label>
              )}
            </div>
          </div>

          {/* ── Articles ── */}
          {items.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-16 text-center">
              <Package className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-4 stroke-1" />
              <p className="text-sm font-medium text-on-surface-variant/50">
                {search || toBuy || family !== 'all' || categoryId ? t('inventory.emptyFiltered') : t('inventory.empty')}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map(item => (
                <li key={item.id} className={cn('bg-white rounded-2xl border border-stone-200 overflow-hidden', !item.isActive && 'opacity-60')}>
                  <div className="p-4 sm:p-5 flex items-center gap-3">
                    {item.hasVariants ? (
                      <button onClick={() => toggle(item.id)} aria-expanded={isExpanded(item.id)}
                        aria-label={t('inventory.actions.toggleVariants', { name: item.name })} className={ICON_BUTTON}>
                        <ChevronRight className={cn('w-4 h-4 transition-transform', isExpanded(item.id) && 'rotate-90')} />
                      </button>
                    ) : <span className="w-8 shrink-0" />}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-on-surface truncate">{item.name}</p>
                        <span className="px-2 py-0.5 rounded-full bg-stone-100 text-[9px] font-bold text-on-surface-variant/60 uppercase tracking-widest">{item.category.name}</span>
                        {item.hasVariants && <span className="text-[10px] text-on-surface-variant/50">{t('inventory.badges.variants', { count: item.variants.filter(v => v.isActive).length })}</span>}
                        {badges(item.isBelowMin, item.isActive)}
                      </div>
                      {canSeeValue && item.value != null && item.value > 0 && (
                        <p className="text-[10px] text-on-surface-variant/50 mt-0.5">{t('inventory.valueLine', { value: formatCurrency(item.value) })}</p>
                      )}
                    </div>

                    {quantityCell(item.quantity, item.unit, item.minStock)}

                    <div className="flex items-center shrink-0">
                      {canReport && !item.hasVariants && item.isActive && (
                        <button onClick={() => openReport(item.id)} aria-label={t('inventory.actions.reportFor', { name: item.name })} className={ICON_BUTTON}>
                          <ClipboardList className="w-4 h-4" />
                        </button>
                      )}
                      {canManage && item.isActive && (
                        <button onClick={() => setVariantsFor(item)} aria-label={t('inventory.actions.addVariantsFor', { name: item.name })} className={ICON_BUTTON}>
                          <Layers className="w-4 h-4" />
                        </button>
                      )}
                      {canManage && (
                        <button onClick={() => editItem(item)} aria-label={t('inventory.actions.editFor', { name: item.name })} className={ICON_BUTTON}>
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => openHistory(item.id, item.name)} aria-label={t('inventory.actions.historyFor', { name: item.name })} className={ICON_BUTTON}>
                        <History className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {item.hasVariants && isExpanded(item.id) && (
                    <ul className="border-t border-stone-100 bg-stone-50/50 divide-y divide-stone-100">
                      {item.variants.map(v => (
                        <li key={v.id} className={cn('pl-14 pr-4 sm:pr-5 py-3 flex items-center gap-3', !v.isActive && 'opacity-60')}>
                          <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                            <p className="text-sm text-on-surface truncate">{v.name}</p>
                            {badges(v.isBelowMin, v.isActive)}
                          </div>
                          {quantityCell(v.quantity, item.unit, v.minStock)}
                          <div className="flex items-center shrink-0">
                            {canReport && v.isActive && (
                              <button onClick={() => openReport(v.id)} aria-label={t('inventory.actions.reportFor', { name: v.displayName })} className={ICON_BUTTON}>
                                <ClipboardList className="w-4 h-4" />
                              </button>
                            )}
                            {canManage && (
                              <button onClick={() => editVariant(item, v)} aria-label={t('inventory.actions.editFor', { name: v.displayName })} className={ICON_BUTTON}>
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => openHistory(v.id, v.displayName)} aria-label={t('inventory.actions.historyFor', { name: v.displayName })} className={ICON_BUTTON}>
                              <History className="w-4 h-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {tab === 'movements' && (
        <>
          {/* ── Journal des mouvements ── */}
          <div className="flex flex-wrap items-center gap-3">
            <select value={movementType} onChange={e => { setMovementType(e.target.value as InventoryMovementType | ''); setPage(1); }}
              aria-label={t('inventory.movement.typeFilter')}
              className="px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
              <option value="">{t('inventory.allTypes')}</option>
              {MOVEMENT_TYPES.map(ty => <option key={ty} value={ty}>{t(`inventory.movementTypes.${ty}`)}</option>)}
            </select>
            {movementItem && (
              <button onClick={() => { setMovementItem(null); setPage(1); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold">
                {t('inventory.movement.filterItem', { name: movementItem.name })}
                <X className="w-3.5 h-3.5" aria-label={t('common.clear')} />
              </button>
            )}
          </div>

          {movementsQuery.isLoading ? <PageLoader /> : movementsQuery.isError ? <PageError /> : (movementsQuery.data?.data.length ?? 0) === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-16 text-center">
              <History className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-4 stroke-1" />
              <p className="text-sm font-medium text-on-surface-variant/50">{t('inventory.movement.empty')}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {movementsQuery.data!.data.map(m => (
                <li key={m.id} className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-on-surface truncate">{m.item.name}</p>
                      <span className="px-2 py-0.5 rounded-full bg-stone-100 text-[9px] font-bold text-on-surface-variant/60 uppercase tracking-widest">{t(`inventory.movementTypes.${m.type}`)}</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant/50 mt-0.5">
                      {formatDateTime(m.createdAt)}
                      {m.createdBy && <> · {m.createdBy.name}</>}
                      {m.booking && <> · {t('inventory.movement.booking', { name: m.booking.guestName })}</>}
                      {m.count && <> · {t('inventory.movement.countRef', { number: m.count.number })}</>}
                      {m.reason && <> · {m.reason}</>}
                      {canSeeValue && m.unitCost != null && <> · {t('inventory.movement.unitCostLine', { value: formatCurrency(m.unitCost) })}</>}
                    </p>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <p className={cn('text-sm font-bold', m.delta > 0 ? 'text-emerald-700' : 'text-red-600')}>
                      {m.delta > 0 ? `+${m.delta}` : m.delta} <span className="text-xs font-medium text-on-surface-variant/60">{m.item.unit}</span>
                    </p>
                    <p className="text-[10px] text-on-surface-variant/50">{t('inventory.movement.after', { quantity: m.quantityAfter })}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {movementsQuery.data && movementsQuery.data.meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button disabled={!movementsQuery.data.meta.hasPrevPage} onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 hover:border-primary/30 transition-colors">
                {t('common.prev')}
              </button>
              <span className="text-[10px] font-bold text-on-surface-variant/50">
                {t('common.page')} {movementsQuery.data.meta.page} {t('common.of')} {movementsQuery.data.meta.totalPages}
              </span>
              <button disabled={!movementsQuery.data.meta.hasNextPage} onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 hover:border-primary/30 transition-colors">
                {t('common.next')}
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'counts' && <InventoryCountsTab />}

      {/* Bouton « Signaler » toujours à portée de pouce sur téléphone. */}
      {canReport && (
        <button onClick={() => openReport(null)}
          className="sm:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 px-6 py-4 bg-zinc-900 text-white rounded-full text-[11px] font-bold uppercase tracking-widest shadow-2xl shadow-black/30">
          <ClipboardList className="w-5 h-5" /> {t('inventory.actions.report')}
        </button>
      )}

      <InventoryCategoryManagerModal isOpen={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
      <InventoryItemModal isOpen={itemModal.open} target={itemModal.target} onClose={() => setItemModal({ open: false, target: null })} />
      <InventoryVariantsModal isOpen={!!variantsFor} item={variantsFor} onClose={() => setVariantsFor(null)} />
      <InventoryMovementModal isOpen={movementModal.open} mode={movementModal.mode} initialItemId={movementModal.itemId}
        onClose={() => setMovementModal(m => ({ ...m, open: false }))} />
    </div>
  );
};
