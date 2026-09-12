import React from 'react';
import { useTranslation } from 'react-i18next';
import { PaymentMethod } from '../../api/invoices';

interface CashAccount { id: string; name: string }

interface Props {
  amount: string;
  onAmountChange: (v: string) => void;
  amountPlaceholder?: string;
  method: PaymentMethod;
  onMethodChange: (v: PaymentMethod) => void;
  accountId: string;
  onAccountChange: (v: string) => void;
  availableAccounts: CashAccount[];
  reference: string;
  onReferenceChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isPending: boolean;
  submitDisabled: boolean;
}

// Formulaire d'encaissement (facture/acompte) ou de remboursement (avoir) — mêmes champs dans les
// deux cas (voir invoice.service.ts: addPayment traite les deux de façon symétrique), partagé par
// InvoiceView.tsx et InvoiceDocument.tsx.
export const InvoicePaymentForm: React.FC<Props> = ({
  amount, onAmountChange, amountPlaceholder, method, onMethodChange, accountId, onAccountChange,
  availableAccounts, reference, onReferenceChange, notes, onNotesChange,
  onCancel, onSubmit, isPending, submitDisabled,
}) => {
  const { t } = useTranslation();

  return (
    <div className="p-6 grid grid-cols-1 gap-4 border-b border-stone-100">
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.amount')}</label>
        <input
          type="number" min={1} value={amount}
          onChange={e => onAmountChange(e.target.value)}
          placeholder={amountPlaceholder}
          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.method')}</label>
        <select
          value={method}
          onChange={e => onMethodChange(e.target.value as PaymentMethod)}
          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        >
          {(['cash', 'mvola', 'orange_money'] as PaymentMethod[]).map(m => (
            <option key={m} value={m}>{t(`invoice.method_${m}`)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.account')}</label>
        <select
          value={accountId}
          onChange={e => onAccountChange(e.target.value)}
          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        >
          {availableAccounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.reference')}</label>
        <input
          type="text" value={reference}
          onChange={e => onReferenceChange(e.target.value)}
          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('common.notes')}</label>
        <input
          type="text" value={notes}
          onChange={e => onNotesChange(e.target.value)}
          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel}
          className="px-4 py-2.5 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-stone-50 transition-colors">
          {t('common.cancel')}
        </button>
        <button
          onClick={onSubmit}
          disabled={submitDisabled || isPending}
          className="px-4 py-2.5 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isPending ? t('common.saving') : t('common.confirm')}
        </button>
      </div>
    </div>
  );
};
