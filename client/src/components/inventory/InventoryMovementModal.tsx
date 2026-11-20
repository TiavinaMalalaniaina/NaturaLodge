import React, { useEffect, useMemo, useState } from 'react';
import { X, AlertCircle, Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../Modal';
import { cn } from '../../lib/utils';
import { getApiErrorMessage } from '../../lib/apiError';
import { useAuth } from '../../context/AuthContext';
import { ManualMovementType, OUTGOING_MOVEMENTS } from '../../api/inventory';
import { useInventoryItems, useRecordInventoryMovement } from '../../hooks/useInventory';
import { SearchSelect, SearchSelectOption } from '../SearchSelect';
import { INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, parseOptionalInt } from './styles';

const PERMISSION: Record<ManualMovementType, string> = {
  purchase:    'inventory.receive',
  consumption: 'inventory.record_usage',
  breakage:    'inventory.record_usage',
  loss:        'inventory.dispose',
  disposal:    'inventory.dispose',
};

interface Props {
  isOpen:  boolean;
  onClose: () => void;
  /** « report » : sorties (utilisé, cassé, perdu, rebut) ; « receive » : entrée d'achat. */
  mode:    'report' | 'receive';
  /** Article (simple) ou variante présélectionné. */
  initialItemId?: string | null;
}

// Ce qu'on peut mouvementer : les articles sans variante et les variantes, jamais un article parent.
interface Choice { id: string; label: string; quantity: number; unit: string; categoryName: string }

export const InventoryMovementModal: React.FC<Props> = ({ isOpen, onClose, mode, initialItemId }) => {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { data: items = [] } = useInventoryItems();
  const record = useRecordInventoryMovement();

  const types = (mode === 'receive' ? (['purchase'] as ManualMovementType[]) : OUTGOING_MOVEMENTS).filter(type => can(PERMISSION[type]));

  const [type, setType]         = useState<ManualMovementType>(types[0] ?? 'consumption');
  const [itemId, setItemId]     = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [reason, setReason]     = useState('');
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setType(types[0] ?? 'consumption');
    setItemId(initialItemId ?? ''); setQuantity('1'); setUnitCost(''); setReason(''); setApiError('');
  }, [isOpen, initialItemId, mode]);

  const choices = useMemo<Choice[]>(() => items.flatMap(item => (item.hasVariants
    ? item.variants.filter(v => v.isActive).map(v => ({ id: v.id, label: v.displayName, quantity: v.quantity, unit: item.unit, categoryName: item.category.name }))
    : [{ id: item.id, label: item.name, quantity: item.quantity, unit: item.unit, categoryName: item.category.name }])), [items]);

  // Triées par catégorie : SearchSelect affiche un intitulé à chaque changement de groupe.
  const options = useMemo<SearchSelectOption[]>(() => [...choices]
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName) || a.label.localeCompare(b.label))
    .map(c => ({ value: c.id, label: c.label, group: c.categoryName, hint: `${c.quantity} ${c.unit}` })), [choices]);

  const selected = choices.find(c => c.id === itemId) ?? null;
  const qty = parseOptionalInt(quantity) ?? 0;
  const isOutgoing = type !== 'purchase';
  const exceeds = !!selected && isOutgoing && qty > selected.quantity;
  const canSubmit = !!selected && qty > 0 && !exceeds;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selected) return;
    setApiError('');
    const cost = parseOptionalInt(unitCost);
    record.mutate(
      {
        type, itemId: selected.id, quantity: qty, reason: reason.trim() || undefined,
        ...(type === 'purchase' && cost != null && can('inventory.view_value') ? { unitCost: cost } : {}),
      },
      { onSuccess: onClose, onError: (err) => setApiError(getApiErrorMessage(err, t('common.error'))) },
    );
  };

  const title = mode === 'receive' ? t('inventory.actions.receive') : t('inventory.actions.report');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}
      className="max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden">
      <div className="p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-display italic text-2xl text-primary leading-none">{title}</h3>
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

        <form onSubmit={handleSubmit} className="space-y-5">
          {types.length > 1 && (
            <fieldset>
              <legend className={LABEL_CLASS}>{t('inventory.movement.what')}</legend>
              <div className="grid grid-cols-2 gap-2">
                {types.map(ty => (
                  <button key={ty} type="button" onClick={() => setType(ty)} aria-pressed={type === ty}
                    className={cn(
                      'py-4 rounded-xl border font-bold text-[11px] tracking-widest uppercase transition-all',
                      type === ty ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-on-surface-variant border-stone-200 hover:border-stone-400',
                    )}>
                    {t(`inventory.movementTypes.${ty}`)}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div>
            <label htmlFor="movement-item" className={LABEL_CLASS}>{t('inventory.movement.item')}</label>
            <SearchSelect id="movement-item" options={options} value={itemId} onChange={setItemId}
              placeholder={t('inventory.movement.chooseItem')} emptyText={t('inventory.emptyFiltered')} />
            {selected && (
              <p className="text-xs text-on-surface-variant/60 mt-1.5">{t('inventory.movement.available', { quantity: selected.quantity, unit: selected.unit })}</p>
            )}
          </div>

          <div>
            <label htmlFor="movement-qty" className={LABEL_CLASS}>{t('inventory.columns.quantity')}</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setQuantity(String(Math.max(1, qty - 1)))} aria-label={t('inventory.movement.decrease')}
                className="p-3.5 bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors"><Minus className="w-4 h-4" /></button>
              <input id="movement-qty" type="number" min={1} inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value)}
                className={cn(INPUT_CLASS, 'text-center text-lg font-bold')} />
              <button type="button" onClick={() => setQuantity(String(qty + 1))} aria-label={t('inventory.movement.increase')}
                className="p-3.5 bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors"><Plus className="w-4 h-4" /></button>
            </div>
            {exceeds && selected && (
              <p role="alert" className="text-xs text-red-600 mt-1.5">{t('inventory.movement.exceeds', { quantity: selected.quantity, unit: selected.unit })}</p>
            )}
          </div>

          {type === 'purchase' && can('inventory.view_value') && (
            <div>
              <label htmlFor="movement-cost" className={LABEL_CLASS}>{t('inventory.form.unitCost')}</label>
              <input id="movement-cost" type="number" min={0} value={unitCost} onChange={e => setUnitCost(e.target.value)} className={INPUT_CLASS} />
            </div>
          )}

          <div>
            <label htmlFor="movement-reason" className={LABEL_CLASS}>{t('inventory.movement.reason')}</label>
            <input id="movement-reason" value={reason} maxLength={500} onChange={e => setReason(e.target.value)}
              placeholder={t('inventory.movement.reasonPlaceholder')} className={INPUT_CLASS} />
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button type="button" onClick={onClose} className={SECONDARY_BUTTON_CLASS}>{t('common.cancel')}</button>
            <button type="submit" disabled={!canSubmit || record.isPending} className={PRIMARY_BUTTON_CLASS}>
              {record.isPending ? t('common.saving') : t('common.confirm')}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
