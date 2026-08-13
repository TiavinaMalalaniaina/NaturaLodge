import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Printer, CreditCard, Plus, AlertCircle, RotateCcw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { useInvoiceByBooking, useGenerateInvoice, useRecordPayment, useVoidPayment } from '../hooks/useInvoices';
import { PaymentMethod } from '../api/invoices';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/QueryLoader';
import { formatDate as fmtDate, formatCurrency as fmtAmount, todayLocalStr } from '../lib/format';
import { INVOICE_STATUS_CLASS as STATUS_CLASS } from '../lib/statusColors';
import { getApiErrorMessage } from '../lib/apiError';
import { ConfirmModal } from '../components/ConfirmModal';

const CollapsibleNote: React.FC<{ notes: string }> = ({ notes }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    const el = textRef.current;
    if (el) {
      // Vérifie si le texte réel dépasse la hauteur de 2 lignes
      setIsTruncated(el.scrollHeight > el.clientHeight);
    }
  }, [notes]);

  return (
    <div className="mt-1">
      <p
        ref={textRef}
        className={cn(
          "text-[11px] text-stone-400 font-light break-words transition-all",
          !isExpanded && "line-clamp-2"
        )}
      >
        {notes}
      </p>
      {isTruncated && (
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          className="text-[9px] font-medium text-primary/70 hover:underline mt-0.5 block focus:outline-none"
        >
          {isExpanded ? "Voir moins" : "Voir plus"}
        </button>
      )}
    </div>
  );
};

export const InvoiceView: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: invoice, isLoading, isError } = useInvoiceByBooking(bookingId ?? null);
  const generateInvoice = useGenerateInvoice();
  const recordPayment = useRecordPayment();
  const voidPayment = useVoidPayment();

  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState('');
  const [dueAt] = useState(() => todayLocalStr());

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [showPayForm, setShowPayForm] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isConfirmRefundModalOpen, setConfirmRefundModalOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  const handleGenerate = () => {
    if (!bookingId) return;
    setApiError('');
    generateInvoice.mutate({
      bookingId,
      taxRate,
      notes: notes || undefined,
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
    }, {
      onError: (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
    });
  };

  const handleRecordPayment = () => {
    if (!invoice) return;
    const amount = parseInt(payAmount, 10);
    if (!amount || amount <= 0) return;
    setApiError('');
    recordPayment.mutate(
      { invoiceId: invoice.id, amount, method: payMethod, reference: payReference || undefined, notes: payNotes || undefined },
      {
        onSuccess: () => {
          setPayAmount('');
          setPayReference('');
          setPayNotes('');
          setShowPayForm(false);
        },
        onError: (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
      },
    );
  };

  const handleVoidPayment = () => {
    if (!invoice) return;
    if (!selectedPaymentId) return;
    setApiError('');
    voidPayment.mutate({ invoiceId: invoice.id, paymentId: selectedPaymentId }, {
      onError: (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
    });
  };

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'RECEPTIONIST';
  const canVoid = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const noInvoice = !isLoading && (isError || !invoice);

  const subtotal = invoice ? invoice.totalAmount - invoice.taxAmount : 0;
  const totalPaid = invoice
    ? invoice.payments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0)
    : 0;
  const remaining = invoice ? Math.max(0, invoice.totalAmount - totalPaid) : 0;
  const canReceivePayment = invoice && invoice.status !== 'paid' && invoice.status !== 'cancelled';

  if (isLoading) return <PageLoader />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* ── Header (hidden on print) ── */}
      <div className="no-print flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full border border-stone-200 bg-white hover:bg-stone-50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
          </button>
          <div>
            <h2 className="font-display italic text-2xl md:text-3xl text-on-surface leading-none">{t('invoice.title')}</h2>
            {invoice && (
              <div className="flex items-center gap-3 mt-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 font-mono">{invoice.number}</p>
                <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border', STATUS_CLASS[invoice.status])}>
                  {t(`invoice.status_${invoice.status}`)}
                </span>
              </div>
            )}
          </div>
        </div>
        {invoice && (
          <button
            onClick={() => window.print()}
            className="p-3 border border-stone-200 rounded-xl hover:bg-stone-50 text-on-surface-variant transition-all flex items-center gap-2 bg-white"
          >
            <Printer className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">Print</span>
          </button>
        )}
      </div>

      {apiError && (
        <div className="no-print flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-xs font-medium">{apiError}</p>
        </div>
      )}

      {/* No invoice – generate form */}
      {noInvoice && (
        <div className="bg-white rounded-3xl border border-stone-200 p-10 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-on-surface-variant/30" />
          </div>
          <div>
            <p className="font-semibold text-on-surface">{t('invoice.noInvoice')}</p>
            <p className="text-xs text-on-surface-variant/50 mt-1">{t('invoice.noInvoiceHint')}</p>
          </div>

          {canManage && (
            <div className="max-w-sm mx-auto space-y-4 text-left">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.taxRate')}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={taxRate}
                  onChange={e => setTaxRate(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={generateInvoice.isPending}
                className="w-full py-3 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generateInvoice.isPending ? t('invoice.generating') : t('invoice.generate')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Invoice document */}
      {invoice && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Document (2/3) ── */}
          <div
            id="invoice-print-area"
            className="lg:col-span-2 bg-white p-8 md:p-14 rounded-3xl shadow-sm border border-stone-200 flex flex-col gap-10"
          >
            {/* Branding */}
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

            {/* Bill To + Document Detail */}
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
                    <p className="font-mono mt-1">{fmtDate(invoice.issuedAt)}</p>
                  </div>
                  <div>
                    <p className="font-bold opacity-40 uppercase tracking-widest">{t('invoice.registrationRef')}</p>
                    <p className="font-mono mt-1">#{invoice.bookingId.slice(-8).toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="font-bold opacity-40 uppercase tracking-widest">{t('invoice.number')}</p>
                    <p className="font-mono mt-1">{invoice.number}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Line items */}
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

            {/* Totals */}
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
              {totalPaid > 0 && (
                <div className="flex items-center gap-16 text-[10px] font-bold uppercase tracking-widest text-teal-600">
                  <span>{t('invoice.status_paid')}</span>
                  <span className="font-mono">-{fmtAmount(totalPaid)}</span>
                </div>
              )}
              {remaining > 0 && (
                <div className="flex items-center gap-16 text-[10px] font-bold uppercase tracking-widest text-red-600">
                  <span>{t('invoice.remaining')}</span>
                  <span className="font-mono">{fmtAmount(remaining)}</span>
                </div>
              )}
            </div>

            {invoice.notes && (
              <p className="text-[10px] text-on-surface-variant/50 italic border-t border-stone-100 pt-4">{invoice.notes}</p>
            )}
          </div>

          {/* ── Sidebar: payments (1/3, hidden on print) ── */}
          <div className="no-print space-y-6">

            {/* Record payment */}
            {canReceivePayment && canManage && (
              <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
                <div className="p-6 border-b border-stone-100 flex justify-between items-center flex-wrap gap-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{t('invoice.recordPayment')}</h4>
                  <button
                    onClick={() => setShowPayForm(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 text-primary rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('invoice.recordPayment')}
                  </button>
                </div>

                {showPayForm && (
                  <div className="p-6 grid grid-cols-1 gap-4 border-b border-stone-100">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.amount')}</label>
                      <input
                        type="number"
                        min={1}
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        placeholder={String(remaining)}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.method')}</label>
                      <select
                        value={payMethod}
                        onChange={e => setPayMethod(e.target.value as PaymentMethod)}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      >
                        {(['cash', 'card', 'bank_transfer', 'online', 'mvola', 'orange_money'] as PaymentMethod[]).map(m => (
                          <option key={m} value={m}>{t(`invoice.method_${m}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.reference')}</label>
                      <input
                        type="text"
                        value={payReference}
                        onChange={e => setPayReference(e.target.value)}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">Notes</label>
                      <input
                        type="text"
                        value={payNotes}
                        onChange={e => setPayNotes(e.target.value)}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setShowPayForm(false)}
                        className="px-4 py-2.5 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-stone-50 transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={handleRecordPayment}
                        disabled={!payAmount || recordPayment.isPending}
                        className="px-4 py-2.5 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {recordPayment.isPending ? t('common.saving') : t('common.confirm')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Payment history */}
            <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
              <div className="p-6 border-b border-stone-100">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{t('invoice.paymentHistory')}</h4>
              </div>
              {invoice.payments.length === 0 ? (
                <div className="p-10 text-center text-xs text-on-surface-variant/40">{t('invoice.noPayments')}</div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {invoice.payments.map(p => (
                    <div key={p.id} className="p-5 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                          <CreditCard className="w-4 h-4 text-stone-500" />
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col gap-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-sm font-bold text-stone-900 tracking-tight">{fmtAmount(p.amount)}</p>
                          </div>

                          {/* Afficher la référence uniquement si ce n'est pas du cash et qu'elle existe */}
                          {p.reference && p.method !== 'cash' && (
                            <span className="text-[10px] font-mono font-medium px-2 py-0.5 bg-stone-100 text-stone-600 rounded-md w-fit">
                              #{p.reference}
                            </span>
                          )}

                          {/* Utilisation de flex-wrap pour éviter la troncature sur les petits écrans */}
                          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 flex-wrap leading-relaxed">
                            <span className="font-medium text-stone-700">{t(`invoice.method_${p.method}`)}</span>
                            <span className="text-stone-300">•</span>
                            <span>{fmtDate(p.paidAt)}</span>
                            <span className="text-stone-300">•</span>
                            <span className="italic text-stone-400">{p.processedBy.name}</span>
                          </div>

                          <CollapsibleNote notes={p.notes ? p.notes : ""} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 pt-0.5">
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border',
                          p.status === 'completed' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                            p.status === 'refunded' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              'bg-stone-100 text-stone-500 border-stone-200',
                        )}>
                          {p.status}
                        </span>
                        {canVoid && p.status === 'completed' && (
                          <button
                            onClick={() => { setSelectedPaymentId(p.id); setConfirmRefundModalOpen(true); }}
                            disabled={voidPayment.isPending}
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
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={isConfirmRefundModalOpen}
        onClose={() => setConfirmRefundModalOpen(false)}
        onConfirm={() => { handleVoidPayment(); setConfirmRefundModalOpen(false); }}
        title={t('invoice.cancelTitle')}
        message={t('invoice.cancelMessage')}
        confirmLabel={t('invoice.confirmCancel')}
        isPending={voidPayment.isPending}
      />
    </motion.div>
  );
};
