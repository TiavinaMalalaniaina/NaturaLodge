import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCreateContribution, useCashAccounts } from '../hooks/useLedger';
import { getApiErrorMessage } from '../lib/apiError';
import { Modal } from './Modal';

interface CreateContributionModalProps {
  isOpen:  boolean;
  onClose: () => void;
}

export const CreateContributionModal: React.FC<CreateContributionModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const createContribution = useCreateContribution();
  const { data: cashAccounts } = useCashAccounts();

  const [amount,      setAmount]      = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [memo,        setMemo]        = useState('');
  const [apiError,    setApiError]    = useState('');

  const selectedAccountId = toAccountId || cashAccounts?.[0]?.id || '';

  const reset = () => {
    setAmount('');
    setToAccountId('');
    setMemo('');
    setApiError('');
  };

  useEffect(() => { if (isOpen) reset(); }, [isOpen]);

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || parsedAmount <= 0 || !selectedAccountId) return;
    setApiError('');
    createContribution.mutate(
      { toAccountId: selectedAccountId, amount: parsedAmount, memo: memo || undefined },
      {
        onSuccess: handleClose,
        onError:   (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
      },
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('treasury.contribution')}
      className="max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden">
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-display italic text-2xl text-primary leading-none">{t('treasury.contribution')}</h3>
          <button onClick={handleClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        <p className="text-xs text-on-surface-variant/60 mb-6 leading-relaxed">{t('treasury.contributionHint')}</p>

        {apiError && (
          <div className="flex items-center gap-3 p-3 mb-6 bg-red-50 border border-red-100 rounded-xl text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="text-xs font-medium">{apiError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.amount')}</label>
            <input
              type="number" min={1} value={amount} required
              onChange={e => setAmount(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('treasury.toAccount')}</label>
            <select
              value={selectedAccountId}
              onChange={e => setToAccountId(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            >
              {(cashAccounts ?? []).map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">
              {t('expenses.description')} <span className="normal-case font-normal opacity-40">{t('common.optional')}</span>
            </label>
            <input
              type="text" value={memo}
              onChange={e => setMemo(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button type="button" onClick={handleClose}
              className="px-6 py-3 bg-stone-100 text-on-surface-variant rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-stone-200 transition-all">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={createContribution.isPending || !amount || !selectedAccountId}
              className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-black transition-all shadow-xl shadow-black/20 disabled:opacity-50">
              {createContribution.isPending ? t('common.saving') : t('common.confirm')}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
