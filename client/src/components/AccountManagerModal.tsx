import React, { useState } from 'react';
import { X, Plus, Pencil, Power, RotateCcw, AlertCircle, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { LedgerAccountFull, LedgerAccountType } from '../api/ledger';
import { useAllAccounts, useCreateAccount, useUpdateAccount } from '../hooks/useLedger';
import { getApiErrorMessage } from '../lib/apiError';
import { Modal } from './Modal';

interface AccountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACCOUNT_TYPES: LedgerAccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'MVOLA', 'ORANGE_MONEY'];

type FormValues = {
  code: string;
  name: string;
  type: LedgerAccountType;
  isCashAccount: boolean;
  allowedMethods: string[];
};

const DEFAULT_VALUES: FormValues = { code: '', name: '', type: 'EXPENSE', isCashAccount: false, allowedMethods: [] };

export const AccountManagerModal: React.FC<AccountManagerModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { data: accounts = [], isLoading } = useAllAccounts();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  const TYPE_LABEL: Record<LedgerAccountType, string> = {
    ASSET:     t('accounts.type_asset'),
    LIABILITY: t('accounts.type_liability'),
    EQUITY:    t('accounts.type_equity'),
    REVENUE:   t('accounts.type_revenue'),
    EXPENSE:   t('accounts.type_expense'),
  };

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [apiError, setApiError]     = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [values, setValues]         = useState<FormValues>(DEFAULT_VALUES);

  const closeForm = () => { setIsFormOpen(false); setEditingId(null); setValues(DEFAULT_VALUES); setApiError(''); };

  const openAddForm = () => { setEditingId(null); setValues(DEFAULT_VALUES); setApiError(''); setIsFormOpen(true); };

  const openEditForm = (account: LedgerAccountFull) => {
    setEditingId(account.id);
    setValues({
      code: account.code, name: account.name, type: account.type,
      isCashAccount: account.isCashAccount, allowedMethods: account.allowedMethods,
    });
    setApiError('');
    setIsFormOpen(true);
  };

  const toggleMethod = (method: string) => {
    setValues(v => ({
      ...v,
      allowedMethods: v.allowedMethods.includes(method)
        ? v.allowedMethods.filter(m => m !== method)
        : [...v.allowedMethods, method],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    try {
      if (editingId) {
        await updateAccount.mutateAsync({
          id: editingId,
          payload: { name: values.name, isCashAccount: values.isCashAccount, allowedMethods: values.allowedMethods },
        });
      } else {
        await createAccount.mutateAsync(values);
      }
      closeForm();
    } catch (err) {
      setApiError(getApiErrorMessage(err, editingId ? t('accounts.updateError') : t('accounts.createError')));
    }
  };

  const handleToggleActive = async (account: LedgerAccountFull) => {
    setApiError('');
    setTogglingId(account.id);
    try {
      await updateAccount.mutateAsync({ id: account.id, payload: { isActive: !account.isActive } });
    } catch (err) {
      setApiError(getApiErrorMessage(err, account.isActive ? t('accounts.deactivateError') : t('accounts.reactivateError')));
    } finally {
      setTogglingId(null);
    }
  };

  const isSaving = createAccount.isPending || updateAccount.isPending;
  const canSubmit = values.name.trim().length > 0 && (editingId || values.code.trim().length > 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('accounts.title')} zIndexClassName="z-[110]"
      className="max-w-3xl bg-white rounded-[2.5rem] shadow-2xl border border-stone-200 overflow-hidden">

      <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
        <div>
          <h3 className="font-display italic text-2xl text-on-surface">{t('accounts.title')}</h3>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40">{t('accounts.subtitle')}</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-stone-200">
          <X className="w-5 h-5 text-on-surface-variant" />
        </button>
      </div>

      <div className="p-8 grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Account list */}
        <div className="space-y-3 max-h-[55vh] overflow-y-auto no-scrollbar pr-1 md:col-span-3">
          {apiError && !isFormOpen && (
            <div className="flex items-center gap-2 text-red-500 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{apiError}
            </div>
          )}

          {isLoading ? (
            <p className="text-xs text-on-surface-variant/40 text-center py-8">{t('common.loading')}</p>
          ) : accounts.length === 0 ? (
            <p className="text-xs text-on-surface-variant/40 text-center py-8">{t('accounts.empty')}</p>
          ) : accounts.map(account => {
            const isToggling = togglingId === account.id;
            const isEditing  = editingId === account.id;
            return (
              <div key={account.id}
                className={cn('flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100 group hover:border-primary/20 transition-all',
                  isEditing && 'border-primary/40 bg-teal-50/40',
                  (isToggling || !account.isActive) && 'opacity-50')}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-on-surface font-mono">{account.code}</p>
                    <p className="text-sm text-on-surface truncate">{account.name}</p>
                    {account.isCashAccount && (
                      <Wallet className="w-3 h-3 text-on-surface-variant/40 shrink-0" />
                    )}
                    {!account.isActive && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50 bg-stone-200/70 px-2 py-0.5 rounded-full">
                        {t('accounts.inactive')}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-tighter">
                    {TYPE_LABEL[account.type]}
                    {account.isCashAccount && account.allowedMethods.length > 0 && (
                      <> · {account.allowedMethods.map(m => t(`invoice.method_${m.toLowerCase()}`)).join(', ')}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => openEditForm(account)} disabled={isToggling}
                    className="p-2 text-on-surface-variant/40 hover:text-primary transition-colors disabled:cursor-not-allowed"
                    title={t('common.edit')}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleToggleActive(account)} disabled={isToggling}
                    className={cn('p-2 transition-colors disabled:cursor-not-allowed',
                      account.isActive ? 'text-on-surface-variant/40 hover:text-red-500' : 'text-on-surface-variant/40 hover:text-emerald-600')}
                    title={account.isActive ? t('accounts.deactivate') : t('accounts.reactivate')}>
                    {account.isActive ? <Power className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
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
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 block">{t('accounts.code')}</label>
                  <input autoFocus={!editingId} type="text" placeholder="ex. 512600" value={values.code} disabled={!!editingId}
                    onChange={e => setValues(v => ({ ...v, code: e.target.value }))}
                    className="w-full h-12 px-4 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-mono disabled:bg-stone-100 disabled:text-on-surface-variant/50" />
                  {editingId && <p className="text-[10px] text-on-surface-variant/40 mt-1.5">{t('accounts.codeImmutable')}</p>}
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 block">{t('accounts.name')}</label>
                  <input autoFocus={!!editingId} type="text" placeholder={t('accounts.namePlaceholder')} value={values.name}
                    onChange={e => setValues(v => ({ ...v, name: e.target.value }))}
                    className="w-full h-12 px-4 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 block">{t('accounts.type')}</label>
                  <select value={values.type} disabled={!!editingId}
                    onChange={e => setValues(v => ({ ...v, type: e.target.value as LedgerAccountType }))}
                    className="w-full h-12 px-4 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm disabled:bg-stone-100 disabled:text-on-surface-variant/50">
                    {ACCOUNT_TYPES.map(type => <option key={type} value={type}>{TYPE_LABEL[type]}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input type="checkbox" checked={values.isCashAccount}
                    onChange={e => setValues(v => ({ ...v, isCashAccount: e.target.checked }))}
                    className="w-4 h-4 rounded border-stone-300 text-primary focus:ring-primary/30" />
                  <span className="text-xs font-medium text-on-surface">{t('accounts.isCashAccount')}</span>
                </label>
                {values.isCashAccount && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 block">{t('accounts.allowedMethods')}</label>
                    <div className="flex flex-wrap gap-2">
                      {PAYMENT_METHODS.map(method => (
                        <button key={method} type="button" onClick={() => toggleMethod(method)}
                          className={cn('px-3 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all',
                            values.allowedMethods.includes(method)
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white text-on-surface-variant border-stone-200 hover:border-stone-300')}>
                          {t(`invoice.method_${method.toLowerCase()}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                <span className="text-[10px] font-bold uppercase tracking-widest">{t('accounts.new')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 pt-0">
        <p className="text-[10px] text-on-surface-variant/40 leading-relaxed text-center">
          {t('accounts.footerNote')}
        </p>
      </div>
    </Modal>
  );
};
