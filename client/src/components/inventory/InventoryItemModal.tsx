import React, { useEffect, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../Modal';
import { getApiErrorMessage } from '../../lib/apiError';
import { useAuth } from '../../context/AuthContext';
import { useInventoryCategories, useCreateInventoryItem, useUpdateInventoryItem } from '../../hooks/useInventory';
import { INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, parseOptionalInt } from './styles';

// Ce qu'on modifie : un article racine (catégorie et unité modifiables) ou une variante (elles
// suivent celles de son article).
export interface InventoryItemEditTarget {
  id:          string;
  name:        string;
  displayName: string;
  isVariant:   boolean;
  categoryId:  string;
  unit:        string;
  minStock:    number | null;
  unitCost:    number | null;
  isActive:    boolean;
}

interface Props {
  isOpen:  boolean;
  onClose: () => void;
  /** Absent : création d'un article. */
  target?: InventoryItemEditTarget | null;
}

export const InventoryItemModal: React.FC<Props> = ({ isOpen, onClose, target }) => {
  const { t } = useTranslation();
  const { can } = useAuth();
  const canSeeValue = can('inventory.view_value');
  const { data: categories = [] } = useInventoryCategories();
  const activeCategories = categories.filter(c => c.isActive || c.id === target?.categoryId);
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();

  const [name, setName]               = useState('');
  const [categoryId, setCategoryId]   = useState('');
  const [unit, setUnit]               = useState('');
  const [minStock, setMinStock]       = useState('');
  const [unitCost, setUnitCost]       = useState('');
  const [initialQty, setInitialQty]   = useState('');
  const [apiError, setApiError]       = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName(target?.name ?? '');
    setCategoryId(target?.categoryId ?? '');
    setUnit(target?.unit ?? t('inventory.form.defaultUnit'));
    setMinStock(target?.minStock != null ? String(target.minStock) : '');
    setUnitCost(target?.unitCost != null ? String(target.unitCost) : '');
    setInitialQty('');
    setApiError('');
  }, [isOpen, target, t]);

  const selectedCategoryId = categoryId || activeCategories[0]?.id || '';
  const isPending = createItem.isPending || updateItem.isPending;
  const onError = (err: unknown) => setApiError(getApiErrorMessage(err, t('common.error')));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (!target?.isVariant && (!selectedCategoryId || !unit.trim()))) return;
    setApiError('');
    const shared = {
      name:     name.trim(),
      minStock: parseOptionalInt(minStock),
      ...(canSeeValue ? { unitCost: parseOptionalInt(unitCost) } : {}),
    };

    if (!target) {
      createItem.mutate(
        { ...shared, categoryId: selectedCategoryId, unit: unit.trim(), initialQuantity: parseOptionalInt(initialQty) ?? 0 },
        { onSuccess: onClose, onError },
      );
      return;
    }
    updateItem.mutate(
      { id: target.id, payload: { ...shared, ...(target.isVariant ? {} : { categoryId: selectedCategoryId, unit: unit.trim() }) } },
      { onSuccess: onClose, onError },
    );
  };

  const toggleActive = () => {
    if (!target) return;
    setApiError('');
    updateItem.mutate({ id: target.id, payload: { isActive: !target.isActive } }, { onSuccess: onClose, onError });
  };

  const title = target ? t('inventory.form.editTitle') : t('inventory.form.createTitle');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}
      className="max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden">
      <div className="p-5 sm:p-8 sm:max-h-[90vh] sm:overflow-y-auto">
        <div className="flex justify-between items-start mb-6 gap-4">
          <div>
            <h3 className="font-display italic text-2xl text-primary leading-none">{title}</h3>
            {target && <p className="text-xs text-on-surface-variant/60 mt-2">{target.displayName}</p>}
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        {apiError && (
          <div role="alert" className="flex items-center gap-3 p-3 mb-6 bg-red-50 border border-red-100 rounded-xl text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="text-xs font-medium">{apiError}</p>
          </div>
        )}

        {!target && activeCategories.length === 0 ? (
          <p className="text-sm text-on-surface-variant/70">{t('inventory.form.noCategory')}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="inventory-item-name" className={LABEL_CLASS}>{target?.isVariant ? t('inventory.variants.name') : t('inventory.form.name')}</label>
              <input id="inventory-item-name" value={name} onChange={e => setName(e.target.value)} maxLength={120} required className={INPUT_CLASS} />
            </div>

            {target?.isVariant ? (
              <p className="text-xs text-on-surface-variant/60">{t('inventory.form.variantLocked')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="inventory-item-category" className={LABEL_CLASS}>{t('inventory.columns.category')}</label>
                  <select id="inventory-item-category" value={selectedCategoryId} onChange={e => setCategoryId(e.target.value)} className={INPUT_CLASS}>
                    {activeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="inventory-item-unit" className={LABEL_CLASS}>{t('inventory.columns.unit')}</label>
                  <input id="inventory-item-unit" value={unit} onChange={e => setUnit(e.target.value)} maxLength={20} required
                    placeholder={t('inventory.form.unitHint')} className={INPUT_CLASS} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {!target && (
                <div>
                  <label htmlFor="inventory-item-initial" className={LABEL_CLASS}>{t('inventory.form.initialQuantity')}</label>
                  <input id="inventory-item-initial" type="number" min={0} value={initialQty} onChange={e => setInitialQty(e.target.value)} className={INPUT_CLASS} />
                </div>
              )}
              <div>
                <label htmlFor="inventory-item-min" className={LABEL_CLASS}>{t('inventory.form.minStock')}</label>
                <input id="inventory-item-min" type="number" min={0} value={minStock} onChange={e => setMinStock(e.target.value)}
                  placeholder={t('inventory.form.minStockHint')} className={INPUT_CLASS} />
              </div>
              {canSeeValue && (
                <div>
                  <label htmlFor="inventory-item-cost" className={LABEL_CLASS}>{t('inventory.form.unitCost')}</label>
                  <input id="inventory-item-cost" type="number" min={0} value={unitCost} onChange={e => setUnitCost(e.target.value)} className={INPUT_CLASS} />
                </div>
              )}
            </div>
            {!target && <p className="text-xs text-on-surface-variant/60">{t('inventory.form.variantsLater')}</p>}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button type="button" onClick={onClose} className={SECONDARY_BUTTON_CLASS}>{t('common.cancel')}</button>
              {target && (
                <button type="button" onClick={toggleActive} disabled={isPending}
                  className="px-6 py-3 border border-stone-200 text-on-surface-variant rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:border-red-200 hover:text-red-600 transition-all disabled:opacity-50">
                  {target.isActive ? t('inventory.actions.deactivate') : t('inventory.actions.reactivate')}
                </button>
              )}
              <button type="submit" disabled={isPending || !name.trim()} className={PRIMARY_BUTTON_CLASS}>
                {isPending ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
