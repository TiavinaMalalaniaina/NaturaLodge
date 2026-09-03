import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Power, RotateCcw, AlertCircle, Wallet, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { LedgerAccountFull, LedgerAccountType } from '../api/ledger';
import { useAllAccounts, useCreateAccount, useUpdateAccount } from '../hooks/useLedger';
import { getApiErrorMessage } from '../lib/apiError';

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

type TypeFilter = 'ALL' | LedgerAccountType;
type StatusFilter = 'active' | 'inactive' | 'all';

export const Accounts: React.FC = () => {
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

  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [cashOnly,      setCashOnly]     = useState(false);
  const [search,        setSearch]       = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [apiError, setApiError]     = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [values, setValues]         = useState<FormValues>(DEFAULT_VALUES);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter(a =>
      (typeFilter === 'ALL' || a.type === typeFilter) &&
      (statusFilter === 'all' || (statusFilter === 'active' ? a.isActive : !a.isActive)) &&
      (!cashOnly || a.isCashAccount) &&
      (!q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)),
    );
  }, [accounts, typeFilter, statusFilter, cashOnly, search]);

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

  const TYPE_TABS: { key: TypeFilter; label: string }[] = [
    { key: 'ALL', label: t('common.all') },
    ...ACCOUNT_TYPES.map(type => ({ key: type as TypeFilter, label: TYPE_LABEL[type] })),
  ];

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="font-display italic text-3xl md:text-4xl text-primary leading-none">{t('accounts.title')}</h2>
          <p className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-[0.2em] mt-2">
            {t('accounts.subtitle')} — {t('accounts.count', { count: filteredAccounts.length })}
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-black/10"
        >
          <Plus className="w-4 h-4" />
          {t('accounts.new')}
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 flex-wrap">
          {TYPE_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              className={cn(
                'px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all',
                typeFilter === tab.key
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-white text-on-surface-variant border-stone-200 hover:border-primary/30',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('accounts.search')}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {(['active', 'inactive', 'all'] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all',
                  statusFilter === s
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-on-surface-variant border-stone-200 hover:border-stone-300',
                )}
              >
                {t(`accounts.status_${s}`)}
              </button>
            ))}
            <button
              onClick={() => setCashOnly(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all',
                cashOnly
                  ? 'bg-teal-50 text-teal-700 border-teal-200'
                  : 'bg-white text-on-surface-variant border-stone-200 hover:border-stone-300',
              )}
            >
              <Wallet className="w-3 h-3" /> {t('accounts.cashOnly')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Account list */}
        <div className="space-y-3 md:col-span-3">
          {apiError && !isFormOpen && (
            <div className="flex items-center gap-2 text-red-500 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{apiError}
            </div>
          )}

          {isLoading ? (
            <p className="text-xs text-on-surface-variant/40 text-center py-12">{t('common.loading')}</p>
          ) : filteredAccounts.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-16 text-center">
              <p className="text-sm font-medium text-on-surface-variant/50">{t('accounts.empty')}</p>
            </div>
          ) : filteredAccounts.map(account => {
            const isToggling = togglingId === account.id;
            const isEditing  = editingId === account.id;
            return (
              <div key={account.id}
                className={cn('flex items-center justify-between p-4 bg-white rounded-2xl border border-stone-200 group hover:border-primary/20 transition-all',
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
          <div className="md:sticky md:top-6">
            {isFormOpen ? (
              <motion.form onSubmit={handleSave} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-4 p-6 bg-teal-50/50 rounded-3xl border border-primary/10">
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
              <div className="p-6 bg-white rounded-3xl border border-stone-200 space-y-4">
                <p className="text-[10px] text-on-surface-variant/40 leading-relaxed">
                  {t('accounts.footerNote')}
                </p>
                <button onClick={openAddForm}
                  className="w-full py-8 border-2 border-dashed border-stone-200 rounded-2xl flex flex-col items-center justify-center gap-3 text-on-surface-variant/60 hover:border-primary/40 hover:text-primary transition-all group">
                  <Plus className="w-5 h-5 group-hover:scale-125 transition-transform" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{t('accounts.new')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
