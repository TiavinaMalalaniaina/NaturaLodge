import React, { useEffect, useState } from 'react';
import { X, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../Modal';
import { cn } from '../../lib/utils';
import { getApiErrorMessage } from '../../lib/apiError';
import { InventoryItem } from '../../api/inventory';
import { useAddInventoryVariants } from '../../hooks/useInventory';
import { INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, parseOptionalInt } from './styles';

interface Props {
  isOpen:  boolean;
  onClose: () => void;
  item:    InventoryItem | null;
}

interface Row { key: number; name: string; quantity: string; minStock: string }

let rowKey = 0;
const emptyRow = (): Row => ({ key: ++rowKey, name: '', quantity: '', minStock: '' });

export const InventoryVariantsModal: React.FC<Props> = ({ isOpen, onClose, item }) => {
  const { t } = useTranslation();
  const addVariants = useAddInventoryVariants();
  const [rows, setRows]         = useState<Row[]>([emptyRow(), emptyRow()]);
  const [apiError, setApiError] = useState('');

  useEffect(() => { if (isOpen) { setRows([emptyRow(), emptyRow()]); setApiError(''); } }, [isOpen]);

  if (!item) return null;

  // Premières variantes d'un article qui a déjà une quantité : elle doit être entièrement répartie.
  const mustDistribute = !item.hasVariants && item.quantity > 0;
  const filled = rows.filter(r => r.name.trim());
  const distributed = filled.reduce((sum, r) => sum + (parseOptionalInt(r.quantity) ?? 0), 0);
  const canSubmit = filled.length > 0 && (!mustDistribute || distributed === item.quantity);

  const update = (key: number, patch: Partial<Row>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setApiError('');
    addVariants.mutate(
      {
        itemId: item.id,
        variants: filled.map(r => ({ name: r.name.trim(), quantity: parseOptionalInt(r.quantity) ?? 0, minStock: parseOptionalInt(r.minStock) })),
      },
      { onSuccess: onClose, onError: (err) => setApiError(getApiErrorMessage(err, t('common.error'))) },
    );
  };

  const title = t('inventory.variants.title', { name: item.name });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}
      className="max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden">
      <div className="p-5 sm:p-8 sm:max-h-[90vh] sm:overflow-y-auto">
        <div className="flex justify-between items-start mb-4 gap-4">
          <h3 className="font-display italic text-2xl text-primary leading-none">{title}</h3>
          <button onClick={onClose} aria-label={t('common.close')} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>
        <p className="text-xs text-on-surface-variant/70 mb-2">{t('inventory.variants.hint')}</p>
        {mustDistribute && (
          <p className="text-xs text-on-surface-variant/70 mb-2">{t('inventory.variants.distribute', { quantity: item.quantity, unit: item.unit })}</p>
        )}
        {item.hasVariants && (
          <p className="text-xs text-on-surface-variant/70 mb-2">
            {t('inventory.variants.existing', { names: item.variants.map(v => v.name).join(', ') })}
          </p>
        )}

        {apiError && (
          <div role="alert" className="flex items-center gap-3 p-3 my-4 bg-red-50 border border-red-100 rounded-xl text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="text-xs font-medium">{apiError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={r.key} className="grid grid-cols-[1fr_6rem_6rem_auto] gap-2 items-end">
                <div>
                  <label htmlFor={`variant-name-${r.key}`} className={cn(LABEL_CLASS, i > 0 && 'sr-only')}>{t('inventory.variants.name')}</label>
                  <input id={`variant-name-${r.key}`} value={r.name} maxLength={120} onChange={e => update(r.key, { name: e.target.value })}
                    placeholder={t('inventory.variants.namePlaceholder')} className={INPUT_CLASS} />
                </div>
                <div>
                  <label htmlFor={`variant-qty-${r.key}`} className={cn(LABEL_CLASS, i > 0 && 'sr-only')}>{t('inventory.columns.quantity')}</label>
                  <input id={`variant-qty-${r.key}`} type="number" min={0} value={r.quantity} onChange={e => update(r.key, { quantity: e.target.value })} className={INPUT_CLASS} />
                </div>
                <div>
                  <label htmlFor={`variant-min-${r.key}`} className={cn(LABEL_CLASS, i > 0 && 'sr-only')}>{t('inventory.columns.minStock')}</label>
                  <input id={`variant-min-${r.key}`} type="number" min={0} value={r.minStock} onChange={e => update(r.key, { minStock: e.target.value })} className={INPUT_CLASS} />
                </div>
                <button type="button" onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))} disabled={rows.length === 1}
                  aria-label={t('inventory.variants.removeRow')}
                  className="p-3 text-on-surface-variant/50 hover:text-red-600 transition-colors disabled:opacity-30">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setRows(rs => [...rs, emptyRow()])} disabled={rows.length >= 50}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:underline disabled:opacity-40">
            <Plus className="w-4 h-4" /> {t('inventory.variants.addRow')}
          </button>

          {mustDistribute && (
            <p className={cn('text-xs font-bold', distributed === item.quantity ? 'text-primary' : 'text-amber-700')} aria-live="polite">
              {t('inventory.variants.distributed', { done: distributed, total: item.quantity, unit: item.unit })}
            </p>
          )}

          <div className="flex items-center gap-4 pt-2">
            <button type="button" onClick={onClose} className={SECONDARY_BUTTON_CLASS}>{t('common.cancel')}</button>
            <button type="submit" disabled={!canSubmit || addVariants.isPending} className={PRIMARY_BUTTON_CLASS}>
              {addVariants.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
