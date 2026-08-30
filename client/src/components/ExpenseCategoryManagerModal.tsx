import React, { useState } from 'react';
import { X, Plus, Pencil, Power, RotateCcw, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { ExpenseCategoryFull } from '../api/expenses';
import { useExpenseCategories, useCreateExpenseCategory, useUpdateExpenseCategory } from '../hooks/useExpenses';
import { useAllAccounts } from '../hooks/useLedger';
import { getApiErrorMessage } from '../lib/apiError';
import { Modal } from './Modal';

interface ExpenseCategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormValues = { name: string; accountId: string };
const DEFAULT_VALUES: FormValues = { name: '', accountId: '' };

export const ExpenseCategoryManagerModal: React.FC<ExpenseCategoryManagerModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { data: categories = [], isLoading } = useExpenseCategories();
  const { data: accounts = [] } = useAllAccounts();
  const createCategory = useCreateExpenseCategory();
  const updateCategory = useUpdateExpenseCategory();

  const expenseAccounts = accounts.filter(a => a.type === 'EXPENSE' && a.isActive);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [apiError, setApiError]     = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [values, setValues]         = useState<FormValues>(DEFAULT_VALUES);

  const closeForm = () => { setIsFormOpen(false); setEditingId(null); setValues(DEFAULT_VALUES); setApiError(''); };

  const openAddForm = () => {
    setEditingId(null);
    setValues({ name: '', accountId: expenseAccounts[0]?.id ?? '' });
    setApiError('');
    setIsFormOpen(true);
  };

  const openEditForm = (category: ExpenseCategoryFull) => {
    setEditingId(category.id);
    setValues({ name: category.name, accountId: category.account.id });
    setApiError('');
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    try {
      if (editingId) {
        await updateCategory.mutateAsync({ id: editingId, payload: values });
      } else {
        await createCategory.mutateAsync(values);
      }
      closeForm();
    } catch (err) {
      setApiError(getApiErrorMessage(err, editingId ? t('expenseCategories.updateError') : t('expenseCategories.createError')));
    }
  };

  const handleToggleActive = async (category: ExpenseCategoryFull) => {
    setApiError('');
    setTogglingId(category.id);
    try {
      await updateCategory.mutateAsync({ id: category.id, payload: { isActive: !category.isActive } });
    } catch (err) {
      setApiError(getApiErrorMessage(err, category.isActive ? t('expenseCategories.deactivateError') : t('expenseCategories.reactivateError')));
    } finally {
      setTogglingId(null);
    }
  };

  const isSaving = createCategory.isPending || updateCategory.isPending;
  const canSubmit = values.name.trim().length > 0 && values.accountId.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('expenseCategories.title')} zIndexClassName="z-[110]"
      className="max-w-3xl bg-white rounded-[2.5rem] shadow-2xl border border-stone-200 overflow-hidden">

      <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
        <div>
          <h3 className="font-display italic text-2xl text-on-surface">{t('expenseCategories.title')}</h3>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">{t('expenseCategories.subtitle')}</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-stone-200">
          <X className="w-5 h-5 text-on-surface-variant" />
        </button>
      </div>

      <div className="p-8 grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Category list */}
        <div className="space-y-3 max-h-[55vh] overflow-y-auto no-scrollbar pr-1 md:col-span-3">
          {apiError && !isFormOpen && (
            <div className="flex items-center gap-2 text-red-500 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{apiError}
            </div>
          )}

          {isLoading ? (
            <p className="text-xs text-on-surface-variant/40 text-center py-8">{t('common.loading')}</p>
          ) : categories.length === 0 ? (
            <p className="text-xs text-on-surface-variant/40 text-center py-8">{t('expenseCategories.empty')}</p>
          ) : categories.map(category => {
            const isToggling = togglingId === category.id;
            const isEditing  = editingId === category.id;
            return (
              <div key={category.id}
                className={cn('flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100 group hover:border-primary/20 transition-all',
                  isEditing && 'border-primary/40 bg-teal-50/40',
                  (isToggling || !category.isActive) && 'opacity-50')}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-on-surface truncate">{category.name}</p>
                    {!category.isActive && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50 bg-stone-200/70 px-2 py-0.5 rounded-full">
                        {t('expenseCategories.inactive')}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-tighter">
                    {category.account.code} · {category.account.name}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => openEditForm(category)} disabled={isToggling}
                    className="p-2 text-on-surface-variant/40 hover:text-primary transition-colors disabled:cursor-not-allowed"
                    title={t('common.edit')}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleToggleActive(category)} disabled={isToggling}
                    className={cn('p-2 transition-colors disabled:cursor-not-allowed',
                      category.isActive ? 'text-on-surface-variant/40 hover:text-red-500' : 'text-on-surface-variant/40 hover:text-emerald-600')}
                    title={category.isActive ? t('expenseCategories.deactivate') : t('expenseCategories.reactivate')}>
                    {category.isActive ? <Power className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
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
              <motion.form onSubmit={handleSave} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-4 p-6 bg-teal-50/50 rounded-2xl border border-primary/10">
                {apiError && (
                  <div className="flex items-center gap-2 text-red-500 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{apiError}
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 block">{t('expenseCategories.name')}</label>
                  <input autoFocus type="text" placeholder={t('expenseCategories.namePlaceholder')} value={values.name}
                    onChange={e => setValues(v => ({ ...v, name: e.target.value }))}
                    className="w-full h-12 px-4 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 block">{t('expenseCategories.account')}</label>
                  {expenseAccounts.length === 0 ? (
                    <p className="text-[10px] text-red-500">{t('expenseCategories.noExpenseAccount')}</p>
                  ) : (
                    <select value={values.accountId}
                      onChange={e => setValues(v => ({ ...v, accountId: e.target.value }))}
                      className="w-full h-12 px-4 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm">
                      {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                    </select>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={closeForm}
                    className="flex-1 py-3 bg-white text-on-surface-variant rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-stone-100 transition-all">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={isSaving || !canSubmit}
                    className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-primary-container disabled:opacity-40 transition-all">
                    {isSaving ? t('common.saving') : t('common.save')}
                  </button>
                </div>
              </motion.form>
            ) : (
              <button onClick={openAddForm}
                className="w-full h-full min-h-[160px] py-4 border-2 border-dashed border-stone-200 rounded-2xl flex flex-col items-center justify-center gap-3 text-on-surface-variant/60 hover:border-primary/40 hover:text-primary transition-all group">
                <Plus className="w-5 h-5 group-hover:scale-125 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{t('expenseCategories.new')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 pt-0">
        <p className="text-[10px] text-on-surface-variant/40 leading-relaxed text-center">
          {t('expenseCategories.footerNote')}
        </p>
      </div>
    </Modal>
  );
};
