import React, { useState } from 'react';
import { Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Invoice, PaymentMethod, invoiceBalance } from '../../api/invoices';
import { useRefundOverpayment } from '../../hooks/useInvoices';
import { useCashAccounts } from '../../hooks/useLedger';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency as fmtAmount } from '../../lib/format';
import { getApiErrorMessage } from '../../lib/apiError';
import { InvoicePaymentForm } from './InvoicePaymentForm';

// Le client a payé plus que ce qu'il doit (séjour raccourci, paiement en trop…) : on lui rend la
// différence, plafonnée au trop-perçu (invoice.service.ts: refundOverpayment).
export const OverpaymentRefundPanel: React.FC<{ invoice: Invoice; onError: (message: string) => void }> = ({ invoice, onError }) => {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { data: cashAccounts } = useCashAccounts();
  const refundOverpayment = useRefundOverpayment();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [accountId, setAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const { overpaid } = invoiceBalance(invoice);
  // Un acompte imputé fait partie de la facture : son trop-perçu se rembourse depuis la facture.
  if (!invoice.validatedAt || invoice.appliedToInvoice || overpaid <= 0 || !can('invoices.record_payment')) return null;

  const accounts = (cashAccounts ?? []).filter(a => a.allowedMethods.includes(method));
  const selectedAccountId = accountId || accounts[0]?.id || '';
  const value = parseInt(amount, 10) || 0;
  const notice = value > overpaid
    ? { tone: 'error' as const, text: t('invoice.refundOverpaymentTooMuch', { amount: fmtAmount(overpaid) }) }
    : undefined;

  const submit = () => {
    if (value <= 0 || !selectedAccountId) return;
    onError('');
    refundOverpayment.mutate({
      invoiceId: invoice.id, amount: value, method, accountId: selectedAccountId,
      reference: reference || undefined, notes: notes || undefined,
    }, {
      onSuccess: () => { setOpen(false); setAmount(''); setReference(''); setNotes(''); },
      onError: (err) => onError(getApiErrorMessage(err, t('common.error'))),
    });
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
      <div className="p-6 border-b border-stone-100 flex justify-between items-center flex-wrap gap-3">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{t('invoice.overpaidTotal')}</h4>
        <button
          onClick={() => { setOpen(v => !v); if (!amount) setAmount(String(overpaid)); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 text-primary rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
          {t('invoice.refundOverpayment', { amount: fmtAmount(overpaid) })}
        </button>
      </div>
      {open && (
        <InvoicePaymentForm
          amount={amount} onAmountChange={setAmount} amountPlaceholder={String(overpaid)}
          method={method} onMethodChange={m => { setMethod(m); setAccountId(''); }}
          accountId={selectedAccountId} onAccountChange={setAccountId}
          availableAccounts={accounts}
          reference={reference} onReferenceChange={setReference}
          notes={notes} onNotesChange={setNotes}
          onCancel={() => setOpen(false)}
          onSubmit={submit}
          isPending={refundOverpayment.isPending}
          submitDisabled={value <= 0 || value > overpaid || !selectedAccountId}
          notice={notice}
        />
      )}
    </div>
  );
};
