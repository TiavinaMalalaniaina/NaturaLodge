import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { useCreateExpense } from '../hooks/useExpenses';
import { useCashAccounts } from '../hooks/useLedger';
import { ExpenseCategory } from '../api/expenses';
import { getApiErrorMessage } from '../lib/apiError';
import { todayLocalStr } from '../lib/format';
import { Modal } from './Modal';

interface CreateExpenseModalProps {
  isOpen:  boolean;
  onClose: () => void;
}

const CATEGORIES: ExpenseCategory[] = ['supplies', 'utilities', 'maintenance', 'marketing', 'salaries', 'other'];

export const CreateExpenseModal: React.FC<CreateExpenseModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const createExpense = useCreateExpense();
  const { data: cashAccounts } = useCashAccounts();

  const [category,    setCategory]    = useState<ExpenseCategory>('supplies');
  const [amount,       setAmount]       = useState('');
  const [description,  setDescription]  = useState('');
  const [paidFromId,   setPaidFromId]   = useState('');
  const [incurredAt,   setIncurredAt]   = useState(() => todayLocalStr());
  const [apiError,     setApiError]     = useState('');

  const selectedAccountId = paidFromId || cashAccounts?.[0]?.id || '';

  const reset = () => {
    setCategory('supplies');
    setAmount('');
    setDescription('');
    setPaidFromId('');
    setIncurredAt(todayLocalStr());
    setApiError('');
  };

  useEffect(() => { if (isOpen) reset(); }, [isOpen]);

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || parsedAmount <= 0 || !selectedAccountId || !description) return;
    setApiError('');
    createExpense.mutate(
      {
        category,
        amount:      parsedAmount,
        description,
        paidFromId:  selectedAccountId,
        incurredAt:  incurredAt ? new Date(incurredAt).toISOString() : undefined,
      },
      {
        onSuccess: handleClose,
        onError:   (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
      },
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('expenses.record')}
      className="max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden">
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-display italic text-2xl text-primary leading-none">{t('expenses.record')}</h3>
          <button onClick={handleClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        {apiError && (
          <div className="flex items-center gap-3 p-3 mb-6 bg-red-50 border border-red-100 rounded-xl text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="text-xs font-medium">{apiError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-2">{t('expenses.category')}</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(c => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={cn(
                    'py-2.5 rounded-xl border font-bold text-[9px] tracking-widest uppercase transition-all',
                    category === c
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-on-surface-variant border-stone-200 hover:border-stone-400',
                  )}>
                  {t(`expenses.category_${c}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.amount')}</label>
            <input
              type="number" min={1} value={amount} required
              onChange={e => setAmount(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.account')}</label>
            <select
              value={selectedAccountId}
              onChange={e => setPaidFromId(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            >
              {(cashAccounts ?? []).map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('expenses.description')}</label>
            <input
              type="text" value={description} required
              onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('expenses.date')}</label>
            <input
              type="date" value={incurredAt}
              onChange={e => setIncurredAt(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button type="button" onClick={handleClose}
              className="px-6 py-3 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-stone-200 transition-all">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={createExpense.isPending || !amount || !selectedAccountId || !description}
              className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-black transition-all shadow-xl shadow-black/20 disabled:opacity-50">
              {createExpense.isPending ? t('common.saving') : t('common.confirm')}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
