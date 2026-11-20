import React, { useEffect, useState } from 'react';
import { X, AlertCircle, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../Modal';
import { cn } from '../../lib/utils';
import { getApiErrorMessage } from '../../lib/apiError';
import { INVENTORY_FAMILIES, InventoryFamily } from '../../api/inventory';
import { useInventoryCategories, useCreateInventoryCategory, useUpdateInventoryCategory } from '../../hooks/useInventory';
import { INPUT_CLASS, LABEL_CLASS } from './styles';

interface Props {
  isOpen:  boolean;
  onClose: () => void;
}

export const InventoryCategoryManagerModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { data: categories = [] } = useInventoryCategories();
  const createCategory = useCreateInventoryCategory();
  const updateCategory = useUpdateInventoryCategory();

  const [name, setName]         = useState('');
  const [family, setFamily]     = useState<InventoryFamily>('consumable');
  const [apiError, setApiError] = useState('');

  useEffect(() => { if (isOpen) { setName(''); setFamily('consumable'); setApiError(''); } }, [isOpen]);

  const onError = (err: unknown) => setApiError(getApiErrorMessage(err, t('common.error')));

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setApiError('');
    createCategory.mutate({ name: name.trim(), family }, { onSuccess: () => setName(''), onError });
  };

  const toggleActive = (id: string, isActive: boolean) => {
    setApiError('');
    updateCategory.mutate({ id, payload: { isActive: !isActive } }, { onError });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('inventory.categories.title')}
      className="max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden">
      <div className="p-8 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-display italic text-2xl text-primary leading-none">{t('inventory.categories.title')}</h3>
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

        <form onSubmit={handleCreate} className="space-y-3 mb-8">
          <div>
            <label htmlFor="inventory-category-name" className={LABEL_CLASS}>{t('inventory.categories.name')}</label>
            <input id="inventory-category-name" value={name} onChange={e => setName(e.target.value)} maxLength={80} className={INPUT_CLASS} />
          </div>
          <div>
            <label htmlFor="inventory-category-family" className={LABEL_CLASS}>{t('inventory.categories.family')}</label>
            <select id="inventory-category-family" value={family} onChange={e => setFamily(e.target.value as InventoryFamily)} className={INPUT_CLASS}>
              {INVENTORY_FAMILIES.map(f => <option key={f} value={f}>{t(`inventory.families.${f}`)}</option>)}
            </select>
          </div>
          <button type="submit" disabled={!name.trim() || createCategory.isPending}
            className="flex items-center justify-center gap-2 w-full py-3 bg-zinc-900 text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-black transition-all disabled:opacity-50">
            <Plus className="w-4 h-4" />
            {t('inventory.categories.add')}
          </button>
        </form>

        {categories.length === 0 ? (
          <p className="text-sm text-on-surface-variant/60 text-center">{t('inventory.categories.empty')}</p>
        ) : (
          <ul className="divide-y divide-stone-100 border border-stone-200 rounded-2xl">
            {categories.map(c => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className={cn('text-sm font-bold truncate', !c.isActive && 'text-on-surface-variant/40 line-through')}>{c.name}</p>
                  <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest">{t(`inventory.families.${c.family}`)}</p>
                </div>
                <button type="button" onClick={() => toggleActive(c.id, c.isActive)} disabled={updateCategory.isPending}
                  className="shrink-0 px-3 py-1.5 border border-stone-200 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:border-primary/30 transition-colors disabled:opacity-50">
                  {c.isActive ? t('inventory.actions.deactivate') : t('inventory.actions.reactivate')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
};
