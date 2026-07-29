import React, { useState } from 'react';
import { X, Plus, Pencil, Power, RotateCcw, AlertCircle, BedDouble, Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { Extra } from '../api/extras';
import { useExtras, useCreateExtra, useUpdateExtra, useDeleteExtra } from '../hooks/useExtras';
import { getApiErrorMessage } from '../lib/apiError';
import { formatCurrency } from '../lib/format';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { extraFormSchema, ExtraFormValues } from '../lib/schemas/extra.schema';
import { Modal } from './Modal';

interface ExtraManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_VALUES: ExtraFormValues = { name: '', price: 0, pricing: 'one_time' };

export const ExtraManagerModal: React.FC<ExtraManagerModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { data: extras = [], isLoading } = useExtras();
  const createExtra = useCreateExtra();
  const updateExtra  = useUpdateExtra();
  const deleteExtra  = useDeleteExtra();

  const PRICING_LABEL: Record<ExtraFormValues['pricing'], string> = {
    per_night: t('extras.perNight'),
    one_time:  t('extras.oneTime'),
  };

  const [isFormOpen, setIsFormOpen]   = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [apiError, setApiError]       = useState('');
  const [togglingId, setTogglingId]   = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<ExtraFormValues>({
    resolver: zodResolver(extraFormSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const pricing = watch('pricing');

  const closeForm = () => { setIsFormOpen(false); setEditingId(null); reset(DEFAULT_VALUES); setApiError(''); };

  const openAddForm = () => { setEditingId(null); reset(DEFAULT_VALUES); setApiError(''); setIsFormOpen(true); };

  const openEditForm = (extra: Extra) => {
    setEditingId(extra.id);
    reset({ name: extra.name, price: extra.price, pricing: extra.pricing });
    setApiError('');
    setIsFormOpen(true);
  };

  const handleSave = async (data: ExtraFormValues) => {
    setApiError('');
    try {
      if (editingId) {
        await updateExtra.mutateAsync({ id: editingId, ...data });
      } else {
        await createExtra.mutateAsync(data);
      }
      closeForm();
    } catch (err) {
      setApiError(getApiErrorMessage(err, editingId ? t('extras.updateError') : t('extras.createError')));
    }
  };

  const handleToggleActive = async (extra: Extra) => {
    setApiError('');
    setTogglingId(extra.id);
    try {
      if (extra.isActive) {
        await deleteExtra.mutateAsync(extra.id);
      } else {
        await updateExtra.mutateAsync({ id: extra.id, isActive: true });
      }
    } catch (err) {
      setApiError(getApiErrorMessage(err, extra.isActive ? t('extras.deactivateError') : t('extras.reactivateError')));
    } finally {
      setTogglingId(null);
    }
  };

  const isSaving = createExtra.isPending || updateExtra.isPending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('extras.title')} zIndexClassName="z-[110]"
      className="max-w-3xl bg-white rounded-[2.5rem] shadow-2xl border border-stone-200 overflow-hidden">

      <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
        <div>
          <h3 className="font-display italic text-2xl text-on-surface">{t('extras.title')}</h3>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">{t('extras.subtitle')}</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-stone-200">
          <X className="w-5 h-5 text-on-surface-variant" />
        </button>
      </div>

      <div className="p-8 grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Catalog list */}
        <div className="md:col-span-3 space-y-3 max-h-[55vh] overflow-y-auto no-scrollbar pr-1">
          {apiError && !isFormOpen && (
            <div className="flex items-center gap-2 text-red-500 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{apiError}
            </div>
          )}

          {isLoading ? (
            <p className="text-xs text-on-surface-variant/40 text-center py-8">{t('common.loading')}</p>
          ) : extras.length === 0 ? (
            <p className="text-xs text-on-surface-variant/40 text-center py-8">{t('extras.empty')}</p>
          ) : extras.map(extra => {
            const isToggling = togglingId === extra.id;
            const isEditing  = editingId === extra.id;
            return (
              <div key={extra.id}
                className={cn('flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100 group hover:border-primary/20 transition-all',
                  isEditing && 'border-primary/40 bg-teal-50/40',
                  (isToggling || !extra.isActive) && 'opacity-50')}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-on-surface">{extra.name}</p>
                    {!extra.isActive && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50 bg-stone-200/70 px-2 py-0.5 rounded-full">
                        {t('extras.inactive')}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-tighter">
                    {formatCurrency(extra.price)} · {PRICING_LABEL[extra.pricing]}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditForm(extra)} disabled={isToggling}
                    className="p-2 text-on-surface-variant/40 hover:text-primary transition-colors disabled:cursor-not-allowed"
                    title={t('common.edit')}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleToggleActive(extra)} disabled={isToggling}
                    className={cn('p-2 transition-colors disabled:cursor-not-allowed',
                      extra.isActive ? 'text-on-surface-variant/40 hover:text-red-500' : 'text-on-surface-variant/40 hover:text-emerald-600')}
                    title={extra.isActive ? t('extras.deactivate') : t('extras.reactivate')}>
                    {extra.isActive ? <Power className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add / edit panel */}
        <div className="md:col-span-2">
          <div className="md:sticky md:top-0">
            {isFormOpen ? (
              <motion.form onSubmit={handleSubmit(handleSave)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-4 p-6 bg-teal-50/50 rounded-2xl border border-primary/10">
                {apiError && (
                  <div className="flex items-center gap-2 text-red-500 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{apiError}
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 block">{t('extras.name')}</label>
                  <input autoFocus type="text" placeholder={t('extras.namePlaceholder')} {...register('name')}
                    className="w-full h-12 px-4 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm" />
                  {errors.name && <p className="text-[10px] text-red-500 mt-1.5 font-medium">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 block">{t('extras.price')}</label>
                  <input type="number" min={1} placeholder="ex. 15000" {...register('price', { valueAsNumber: true })}
                    className="w-full h-12 px-4 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm" />
                  {errors.price && <p className="text-[10px] text-red-500 mt-1.5 font-medium">{errors.price.message}</p>}
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 block">{t('extras.pricingType')}</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setValue('pricing', 'one_time', { shouldValidate: true })}
                      className={cn('flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border transition-all text-xs font-semibold',
                        pricing === 'one_time' ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-stone-200 hover:border-stone-300')}>
                      <Flame className="w-3.5 h-3.5" /> {t('extras.oneTime')}
                    </button>
                    <button type="button" onClick={() => setValue('pricing', 'per_night', { shouldValidate: true })}
                      className={cn('flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border transition-all text-xs font-semibold',
                        pricing === 'per_night' ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-stone-200 hover:border-stone-300')}>
                      <BedDouble className="w-3.5 h-3.5" /> {t('extras.perNight')}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={closeForm}
                    className="flex-1 py-3 bg-white text-on-surface-variant rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-stone-100 transition-all">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={isSaving}
                    className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-primary-container disabled:opacity-40 transition-all">
                    {isSaving ? t('common.saving') : t('common.save')}
                  </button>
                </div>
              </motion.form>
            ) : (
              <button onClick={openAddForm}
                className="w-full h-full min-h-[160px] py-4 border-2 border-dashed border-stone-200 rounded-2xl flex flex-col items-center justify-center gap-3 text-on-surface-variant/60 hover:border-primary/40 hover:text-primary transition-all group">
                <Plus className="w-5 h-5 group-hover:scale-125 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{t('extras.new')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 pt-0">
        <p className="text-[10px] text-on-surface-variant/40 leading-relaxed text-center">
          {t('extras.footerNote')}
        </p>
      </div>
    </Modal>
  );
};
