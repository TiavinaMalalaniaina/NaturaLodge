import React, { useEffect, useRef, useState } from 'react';
import { CreditCard, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { InvoicePayment, PaymentStatus } from '../../api/invoices';
import { formatDate as fmtDate, formatCurrency as fmtAmount } from '../../lib/format';

const PAYMENT_ROW_STATUS_CLASS: Record<PaymentStatus, string> = {
  completed: 'bg-teal-50   text-teal-700   border-teal-200',
  refunded:  'bg-purple-50 text-purple-700 border-purple-200',
  pending:   'bg-stone-100 text-stone-500  border-stone-200',
  failed:    'bg-stone-100 text-stone-500  border-stone-200',
};

const CollapsibleNote: React.FC<{ notes: string }> = ({ notes }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const el = textRef.current;
    if (el) setIsTruncated(el.scrollHeight > el.clientHeight);
  }, [notes]);

  return (
    <div className="mt-1">
      <p ref={textRef} className={cn('text-[11px] text-stone-400 font-light break-words transition-all', !isExpanded && 'line-clamp-2')}>
        {notes}
      </p>
      {isTruncated && (
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          className="text-[9px] font-medium text-primary/70 hover:underline mt-0.5 block focus:outline-none"
        >
          {isExpanded ? t('common.showLess') : t('common.showMore')}
        </button>
      )}
    </div>
  );
};

interface Props {
  title:     string;
  emptyText: string;
  payments:  InvoicePayment[];
  canVoid:   boolean;
  onVoidRequest: (paymentId: string) => void;
  isVoiding: boolean;
}

// Historique des paiements/remboursements — partagé par InvoiceView.tsx et InvoiceDocument.tsx.
// Montant, méthode, compte, date, ET auteur + note du geste sont toujours affichés ici : avant
// cette extraction, InvoiceDocument.tsx (acompte/avoir) omettait l'auteur et la note visibles sur
// InvoiceView.tsx (facture standard) pour le même type de donnée.
export const InvoicePaymentHistory: React.FC<Props> = ({ title, emptyText, payments, canVoid, onVoidRequest, isVoiding }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
      <div className="p-6 border-b border-stone-100">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{title}</h4>
      </div>
      {payments.length === 0 ? (
        <div className="p-10 text-center text-xs text-on-surface-variant/40">{emptyText}</div>
      ) : (
        <div className="divide-y divide-stone-100">
          {payments.map(p => (
            <div key={p.id} className="p-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <CreditCard className="w-4 h-4 text-stone-500" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <p className="text-sm font-bold text-stone-900 tracking-tight">{fmtAmount(p.amount)}</p>

                  {p.reference && p.method !== 'cash' && (
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 bg-stone-100 text-stone-600 rounded-md w-fit">
                      #{p.reference}
                    </span>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] text-stone-500 flex-wrap leading-relaxed">
                    <span className="font-medium text-stone-700">{t(`invoice.method_${p.method}`)}</span>
                    <span className="text-stone-300">•</span>
                    <span>{p.account.name}</span>
                    <span className="text-stone-300">•</span>
                    <span>{fmtDate(p.paidAt)}</span>
                    <span className="text-stone-300">•</span>
                    <span className="italic text-stone-400" title={t('invoice.processedBy')}>{p.processedBy.name}</span>
                  </div>

                  {p.notes && <CollapsibleNote notes={p.notes} />}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 pt-0.5">
                <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border', PAYMENT_ROW_STATUS_CLASS[p.status])}>
                  {t(`invoice.paymentStatus_${p.status}`)}
                </span>
                {canVoid && p.status === 'completed' && (
                  <button
                    onClick={() => onVoidRequest(p.id)}
                    disabled={isVoiding}
                    className="p-2 rounded-xl text-on-surface-variant/40 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title={t('invoice.voidPayment')}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
