import React, { useState, useEffect } from 'react';
import { X, AlertCircle, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCreateTransfer, useCashAccounts } from '../hooks/useLedger';
import { getApiErrorMessage } from '../lib/apiError';
import { Modal } from './Modal';

interface CreateTransferModalProps {
  isOpen:  boolean;
  onClose: () => void;
}

export const CreateTransferModal: React.FC<CreateTransferModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const createTransfer = useCreateTransfer();
  const { data: cashAccounts } = useCashAccounts();

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId,   setToAccountId]   = useState('');
  const [amount,        setAmount]        = useState('');
  const [memo,          setMemo]          = useState('');
  const [apiError,      setApiError]      = useState('');

  const selectedFromId = fromAccountId || cashAccounts?.[0]?.id || '';
  const selectedToId   = toAccountId   || cashAccounts?.find(a => a.id !== selectedFromId)?.id || '';

  const reset = () => {
    setFromAccountId('');
    setToAccountId('');
    setAmount('');
    setMemo('');
    setApiError('');
  };

  useEffect(() => { if (isOpen) reset(); }, [isOpen]);

  const handleClose = () => { reset(); onClose(); };

  const isSameAccount = !!selectedFromId && selectedFromId === selectedToId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || parsedAmount <= 0 || !selectedFromId || !selectedToId || isSameAccount) return;
    setApiError('');
    createTransfer.mutate(
      { fromAccountId: selectedFromId, toAccountId: selectedToId, amount: parsedAmount, memo: memo || undefined },
      {
        onSuccess: handleClose,
        onError:   (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
      },
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('treasury.transfer')}
      className="max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden">
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-display italic text-2xl text-primary leading-none">{t('treasury.transfer')}</h3>
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
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('treasury.fromAccount')}</label>
              <select
                value={selectedFromId}
                onChange={e => setFromAccountId(e.target.value)}
                className="w-full px-3 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                {(cashAccounts ?? []).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <ArrowRight className="w-4 h-4 text-on-surface-variant/40 mb-3.5" />
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('treasury.toAccount')}</label>
              <select
                value={selectedToId}
                onChange={e => setToAccountId(e.target.value)}
                className="w-full px-3 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                {(cashAccounts ?? []).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          {isSameAccount && (
            <p className="text-xs text-red-500">{t('treasury.sameAccountError')}</p>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.amount')}</label>
            <input
              type="number" min={1} value={amount} required
              onChange={e => setAmount(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
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
            <button type="submit" disabled={createTransfer.isPending || !amount || !selectedFromId || !selectedToId || isSameAccount}
              className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-black transition-all shadow-xl shadow-black/20 disabled:opacity-50">
              {createTransfer.isPending ? t('common.saving') : t('common.confirm')}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
