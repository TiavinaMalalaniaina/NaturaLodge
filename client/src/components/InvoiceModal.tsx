import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, Building2, CreditCard, Plus, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { useInvoiceByBooking, useGenerateInvoice, useRecordPayment, useVoidPayment } from '../hooks/useInvoices';
import { PaymentMethod, InvoiceStatus } from '../api/invoices';
import { useAuth } from '../context/AuthContext';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtAmount(n: number) {
  return n.toLocaleString('fr-MG') + ' Ar';
}

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  pending:        'bg-amber-50 text-amber-700 border-amber-200',
  partially_paid: 'bg-blue-50 text-blue-700 border-blue-200',
  paid:           'bg-teal-50 text-teal-700 border-teal-200',
  refunded:       'bg-purple-50 text-purple-700 border-purple-200',
  cancelled:      'bg-stone-100 text-stone-500 border-stone-200',
};

interface InvoiceModalProps {
  isOpen:    boolean;
  onClose:   () => void;
  bookingId: string | null;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, bookingId }) => {
  const { t }    = useTranslation();
  const { user } = useAuth();

  const { data: invoice, isLoading, isError } = useInvoiceByBooking(isOpen ? bookingId : null);
  const generateInvoice = useGenerateInvoice();
  const recordPayment   = useRecordPayment();
  const voidPayment     = useVoidPayment();

  const [taxRate, setTaxRate] = useState(0);
  const [notes,   setNotes]   = useState('');
  const [dueAt,   setDueAt]   = useState('');

  const [payAmount,    setPayAmount]    = useState('');
  const [payMethod,    setPayMethod]    = useState<PaymentMethod>('cash');
  const [payReference, setPayReference] = useState('');
  const [payNotes,     setPayNotes]     = useState('');
  const [showPayForm,  setShowPayForm]  = useState(false);

  const invoiceRef = useRef<HTMLDivElement>(null);

  const handleGenerate = () => {
    if (!bookingId) return;
    generateInvoice.mutate({
      bookingId,
      taxRate,
      notes: notes || undefined,
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
    });
  };

  const handleRecordPayment = () => {
    if (!invoice) return;
    const amount = parseInt(payAmount, 10);
    if (!amount || amount <= 0) return;
    recordPayment.mutate(
      { invoiceId: invoice.id, amount, method: payMethod, reference: payReference || undefined, notes: payNotes || undefined },
      {
        onSuccess: () => {
          setPayAmount('');
          setPayReference('');
          setPayNotes('');
          setShowPayForm(false);
        },
      },
    );
  };

  const handleVoidPayment = (paymentId: string) => {
    if (!invoice) return;
    voidPayment.mutate({ invoiceId: invoice.id, paymentId });
  };

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'RECEPTIONIST';
  const canVoid   = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const noInvoice = !isLoading && (isError || !invoice);

  const subtotal  = invoice ? invoice.totalAmount - invoice.taxAmount : 0;
  const totalPaid = invoice
    ? invoice.payments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0)
    : 0;
  const remaining = invoice ? Math.max(0, invoice.totalAmount - totalPaid) : 0;
  const canReceivePayment = invoice && invoice.status !== 'paid' && invoice.status !== 'cancelled';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl max-h-[90vh] bg-stone-50 rounded-[2.5rem] shadow-2xl border border-stone-200 overflow-hidden flex flex-col"
          >
            {/* ── Header ── */}
            <div className="p-6 md:p-8 border-b border-stone-200 bg-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-display italic text-2xl text-on-surface">{t('invoice.title')}</h3>
                {invoice && (
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 font-mono">{invoice.number}</p>
                    <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border', STATUS_CLASS[invoice.status])}>
                      {t(`invoice.status_${invoice.status}`)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {invoice && (
                  <button
                    onClick={() => window.print()}
                    className="p-3 border border-stone-200 rounded-xl hover:bg-stone-50 text-on-surface-variant transition-all flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">Print</span>
                  </button>
                )}
                <button onClick={onClose} className="p-3 bg-white border border-stone-200 rounded-full hover:bg-stone-50 transition-colors">
                  <X className="w-5 h-5 text-on-surface-variant/60" />
                </button>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 no-scrollbar space-y-6">

              {/* Loading */}
              {isLoading && (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
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
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.due')}</label>
                        <input
                          type="date"
                          value={dueAt}
                          onChange={e => setDueAt(e.target.value)}
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
                <div
                  ref={invoiceRef}
                  className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-stone-200 flex flex-col gap-10"
                >
                  {/* Branding */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-3">
                      <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center">
                        <Building2 className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h4 className="font-display italic text-3xl leading-none">Natura Lodge</h4>
                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40 mt-1">Lodge & Retreat</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-xs font-bold uppercase tracking-widest">Natura Lodge</p>
                      <p className="text-[10px] text-on-surface-variant/60 leading-relaxed">Madagascar</p>
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
                          <p className="font-bold opacity-40 uppercase tracking-widest">{t('invoice.due')}</p>
                          <p className="font-mono mt-1">{invoice.dueAt ? fmtDate(invoice.dueAt) : '—'}</p>
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
              )}

              {/* Record payment */}
              {canReceivePayment && canManage && (
                <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
                  <div className="p-6 border-b border-stone-100 flex justify-between items-center">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{t('invoice.recordPayment')}</h4>
                    <button
                      onClick={() => setShowPayForm(v => !v)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 text-primary rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t('invoice.recordPayment')}
                    </button>
                  </div>

                  <AnimatePresence>
                    {showPayForm && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-stone-100">
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
                              {(['cash', 'card', 'bank_transfer', 'online'] as PaymentMethod[]).map(m => (
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
                          <div className="sm:col-span-2 flex justify-end gap-3">
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Payment history */}
              {invoice && (
                <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
                  <div className="p-6 border-b border-stone-100">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{t('invoice.paymentHistory')}</h4>
                  </div>
                  {invoice.payments.length === 0 ? (
                    <div className="p-10 text-center text-xs text-on-surface-variant/40">{t('invoice.noPayments')}</div>
                  ) : (
                    <div className="divide-y divide-stone-100">
                      {invoice.payments.map(p => (
                        <div key={p.id} className="p-5 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-9 h-9 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center shrink-0">
                              <CreditCard className="w-4 h-4 text-on-surface-variant/50" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-on-surface">{fmtAmount(p.amount)}</p>
                              <p className="text-[10px] text-on-surface-variant/50 mt-0.5">
                                {t(`invoice.method_${p.method}`)} · {fmtDate(p.paidAt)} · {p.processedBy.name}
                              </p>
                              {p.reference && (
                                <p className="text-[10px] font-mono text-on-surface-variant/40 mt-0.5">#{p.reference}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border',
                              p.status === 'completed' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                              p.status === 'refunded'  ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                         'bg-stone-100 text-stone-500 border-stone-200',
                            )}>
                              {p.status}
                            </span>
                            {canVoid && p.status === 'completed' && (
                              <button
                                onClick={() => handleVoidPayment(p.id)}
                                disabled={voidPayment.isPending}
                                className="p-2 rounded-xl text-on-surface-variant/40 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                                title={t('invoice.voidPayment')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
