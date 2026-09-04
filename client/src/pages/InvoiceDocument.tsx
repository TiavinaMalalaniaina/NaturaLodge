import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Printer, ShieldCheck, AlertCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { useInvoice, useValidateInvoice } from '../hooks/useInvoices';
import { useAuth } from '../context/AuthContext';
import { PageLoader, PageError } from '../components/QueryLoader';
import { formatDate as fmtDate, formatCurrency as fmtAmount } from '../lib/format';
import { getApiErrorMessage } from '../lib/apiError';

// Vue lecture seule d'un document de facturation adressé par son propre id (acompte ou avoir —
// une facture STANDARD reste consultée via /invoices/:bookingId, voir InvoiceView.tsx). Pas de
// formulaire de paiement ni d'édition de lignes ici : seule action possible, le viser s'il est
// encore brouillon.
export const InvoiceDocument: React.FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { can } = useAuth();

  const { data: invoice, isLoading, isError } = useInvoice(invoiceId ?? null);
  const validateInvoice = useValidateInvoice();
  const [apiError, setApiError] = React.useState('');

  const canValidate = can('invoices.validate');

  if (isLoading) return <PageLoader />;
  if (isError || !invoice) return <PageError />;

  const isDraft = !invoice.validatedAt;
  const subtotal = invoice.totalAmount - invoice.taxAmount;

  const handleValidate = () => {
    setApiError('');
    validateInvoice.mutate(invoice.id, {
      onError: (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

      <div className="no-print flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full border border-stone-200 bg-white hover:bg-stone-50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
          </button>
          <div>
            <h2 className="font-display italic text-2xl md:text-3xl text-on-surface leading-none">{t(`invoice.kind_${invoice.kind}`)}</h2>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 font-mono">{invoice.number ?? t('invoice.draft')}</p>
              {isDraft && (
                <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border bg-amber-50 text-amber-700 border-amber-200">
                  {t('invoice.draft')}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isDraft && canValidate && (
            <button
              onClick={handleValidate}
              disabled={validateInvoice.isPending}
              className="p-3 border border-primary/30 rounded-xl hover:bg-primary/5 text-primary transition-all flex items-center gap-2 bg-white disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">
                {validateInvoice.isPending ? t('common.saving') : t('invoice.validate')}
              </span>
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="p-3 border border-stone-200 rounded-xl hover:bg-stone-50 text-on-surface-variant transition-all flex items-center gap-2 bg-white"
          >
            <Printer className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">Print</span>
          </button>
        </div>
      </div>

      {apiError && (
        <div className="no-print flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-xs font-medium">{apiError}</p>
        </div>
      )}

      {isDraft && (
        <div className="no-print flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-xs font-medium">{t('invoice.draftHint')}</p>
        </div>
      )}

      <div
        id="invoice-print-area"
        className="max-w-3xl bg-white p-8 md:p-14 rounded-3xl shadow-sm border border-stone-200 flex flex-col gap-10"
      >
        <div className="flex justify-between items-start">
          <div className="space-y-3">
            <div className="w-24 h-24 flex items-center justify-center">
              <img src='/logo.png' alt='Natura Lodge Logo' />
            </div>
          </div>
          <div className="text-right space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest">Natura Lodge</p>
            <p className="text-[10px] text-on-surface-variant/60 leading-relaxed">Madagascar - Manambato</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10">
          <div>
            <h5 className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-3 pb-2 border-b border-stone-100">{t('invoice.billTo')}</h5>
            <p className="text-base font-bold text-on-surface">{invoice.booking.guest.name}</p>
            <p className="text-[10px] text-on-surface-variant/60 mt-1">{invoice.booking.guest.email}</p>
          </div>
          <div>
            <h5 className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-3 pb-2 border-b border-stone-100">{t('invoice.documentDetail')}</h5>
            <div className="grid grid-cols-2 gap-y-3 text-[10px]">
              <div>
                <p className="font-bold opacity-40 uppercase tracking-widest">{t('invoice.issued')}</p>
                <p className="font-mono mt-1">{isDraft ? '—' : fmtDate(invoice.issuedAt)}</p>
              </div>
              <div>
                <p className="font-bold opacity-40 uppercase tracking-widest">{t('invoice.registrationRef')}</p>
                <p className="font-mono mt-1">#{invoice.bookingId.slice(-8).toUpperCase()}</p>
              </div>
              <div>
                <p className="font-bold opacity-40 uppercase tracking-widest">{t('invoice.number')}</p>
                <p className="font-mono mt-1">{invoice.number ?? t('invoice.draft')}</p>
              </div>
              {invoice.relatesToInvoice && (
                <div>
                  <p className="font-bold opacity-40 uppercase tracking-widest">{t('invoice.relatesTo')}</p>
                  <p className="font-mono mt-1">{invoice.relatesToInvoice.number ?? '—'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <h5 className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-4 pb-2 border-b border-stone-100">{t('invoice.items')}</h5>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-stone-200">
                {['Description', 'Qté', 'P.U.', t('invoice.total')].map((h, i) => (
                  <th key={i} className={cn('py-3 text-[10px] font-bold uppercase tracking-widest opacity-40', i > 0 && 'text-right', i === 1 && 'text-center')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {invoice.items.map(item => (
                <tr key={item.id}>
                  <td className="py-4 text-sm font-medium text-on-surface">{item.description}</td>
                  <td className="py-4 text-center text-xs font-mono">{item.quantity}</td>
                  <td className="py-4 text-right text-xs font-mono">{fmtAmount(item.unitPrice)}</td>
                  <td className="py-4 text-right text-sm font-bold">{fmtAmount(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-end gap-3 pt-6 border-t-2 border-stone-900">
          <div className="flex items-center gap-16 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
            <span>{t('invoice.subtotal')}</span>
            <span className="font-mono text-on-surface">{fmtAmount(subtotal)}</span>
          </div>
          {invoice.taxAmount > 0 && (
            <div className="flex items-center gap-16 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
              <span>{t('invoice.tax')}</span>
              <span className="font-mono text-on-surface">{fmtAmount(invoice.taxAmount)}</span>
            </div>
          )}
          <div className="flex items-center gap-16 pt-4 border-t border-stone-100">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-on-surface-variant">{t('invoice.total')}</span>
            <span className="text-3xl font-display italic text-primary leading-none">{fmtAmount(invoice.totalAmount)}</span>
          </div>
        </div>

        {invoice.notes && (
          <p className="text-[10px] text-on-surface-variant/50 italic border-t border-stone-100 pt-4">{invoice.notes}</p>
        )}
      </div>
    </motion.div>
  );
};
