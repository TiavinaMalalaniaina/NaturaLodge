import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Printer, ShieldCheck, AlertCircle, Plus, CreditCard, RotateCcw, Trash2, SquarePen } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { useInvoice, useValidateInvoice, useRecordPayment, useVoidPayment, useUpdateInvoice, useDeleteDraftInvoice } from '../hooks/useInvoices';
import { useCashAccounts } from '../hooks/useLedger';
import { PaymentMethod } from '../api/invoices';
import { useAuth } from '../context/AuthContext';
import { PageLoader, PageError } from '../components/QueryLoader';
import { formatDate as fmtDate, formatCurrency as fmtAmount } from '../lib/format';
import { getApiErrorMessage } from '../lib/apiError';
import { ConfirmModal } from '../components/ConfirmModal';

// Vue d'un document de facturation adressé par son propre id (acompte ou avoir — une facture
// STANDARD reste consultée via /invoices/:bookingId, voir InvoiceView.tsx). Pas d'édition de
// lignes ici. Un acompte VISÉ peut recevoir un paiement réel (le document lui-même n'est qu'une
// créance — voir invoice.service.ts : la facture d'acompte ≠ l'argent effectivement encaissé,
// exactement comme pour une facture normale) ; un avoir n'en reçoit jamais.
export const InvoiceDocument: React.FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { can } = useAuth();

  const { data: invoice, isLoading, isError } = useInvoice(invoiceId ?? null);
  const validateInvoice = useValidateInvoice();
  const recordPayment = useRecordPayment();
  const voidPayment = useVoidPayment();
  const updateInvoice = useUpdateInvoice();
  const deleteDraftInvoice = useDeleteDraftInvoice();
  const { data: cashAccounts } = useCashAccounts();
  const [apiError, setApiError] = React.useState('');

  const [payAmount, setPayAmount] = React.useState('');
  const [payMethod, setPayMethod] = React.useState<PaymentMethod>('cash');
  const [payAccountId, setPayAccountId] = React.useState('');
  const [payReference, setPayReference] = React.useState('');
  const [payNotes, setPayNotes] = React.useState('');
  const [showPayForm, setShowPayForm] = React.useState(false);
  const [isConfirmRefundModalOpen, setConfirmRefundModalOpen] = React.useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = React.useState<string | null>(null);
  const [confirmDeleteDraft, setConfirmDeleteDraft] = React.useState(false);
  const [showEditForm, setShowEditForm] = React.useState(false);
  const [editAmount, setEditAmount] = React.useState('');
  const [editNotes, setEditNotes] = React.useState('');

  const canValidate = can('invoices.validate');
  const canRecordPayment = can('invoices.record_payment');
  const canVoid = can('invoices.void_payment');
  const canDeleteDraft = can('invoices.delete_draft');
  const canUpdate = can('invoices.update');

  if (isLoading) return <PageLoader />;
  if (isError || !invoice) return <PageError />;

  const isDraft = !invoice.validatedAt;
  const isRefundDoc = invoice.kind === 'credit_note';
  const subtotal = invoice.totalAmount - invoice.taxAmount;
  const totalPaid = invoice.payments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
  // Pour un avoir : on ne peut rembourser que ce qui a réellement été encaissé sur le document
  // crédité, borné au montant de l'avoir (le serveur applique la même règle, voir addPayment).
  const collectedOnCredited = invoice.relatesToInvoice?.collectedAmount;
  const refundCeiling = isRefundDoc && collectedOnCredited !== undefined
    ? Math.min(invoice.totalAmount, collectedOnCredited)
    : invoice.totalAmount;
  const remaining = Math.max(0, refundCeiling - totalPaid);
  const nothingToRefund = isRefundDoc && !isDraft && refundCeiling === 0;
  // Un acompte s'encaisse directement ; un avoir, une fois visé, se rembourse (mouvement de sens
  // inverse — voir invoice.service.ts: addPayment). Dans les deux cas le document doit être visé.
  const canReceivePayment = (invoice.kind === 'deposit' || isRefundDoc) && !isDraft
    && invoice.status !== 'paid' && invoice.status !== 'cancelled'
    && (!isRefundDoc || remaining > 0);

  const accountsForMethod = (cashAccounts ?? []).filter(a => a.allowedMethods.includes(payMethod));
  const availableAccounts = accountsForMethod.length > 0 ? accountsForMethod : (cashAccounts ?? []);
  const selectedAccountId = payAccountId || availableAccounts[0]?.id || '';

  const handleValidate = () => {
    setApiError('');
    validateInvoice.mutate(invoice.id, {
      onError: (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
    });
  };

  const handleRecordPayment = () => {
    const amount = parseInt(payAmount, 10);
    if (!amount || amount <= 0 || !selectedAccountId) return;
    setApiError('');
    recordPayment.mutate(
      { invoiceId: invoice.id, amount, method: payMethod, accountId: selectedAccountId, reference: payReference || undefined, notes: payNotes || undefined },
      {
        onSuccess: () => {
          setPayAmount(''); setPayAccountId(''); setPayReference(''); setPayNotes(''); setShowPayForm(false);
        },
        onError: (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
      },
    );
  };

  const handleVoidPayment = () => {
    if (!selectedPaymentId) return;
    setApiError('');
    voidPayment.mutate({ invoiceId: invoice.id, paymentId: selectedPaymentId }, {
      onError: (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
    });
  };

  const openEditForm = () => {
    setEditAmount(String(invoice.totalAmount));
    setEditNotes(invoice.notes ?? '');
    setShowEditForm(true);
  };

  const handleSaveEdit = () => {
    const amount = parseInt(editAmount, 10);
    if (!amount || amount <= 0) return;
    setApiError('');
    updateInvoice.mutate(
      { id: invoice.id, amount, notes: editNotes || undefined },
      {
        onSuccess: () => setShowEditForm(false),
        onError:   (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
      },
    );
  };

  const handleDeleteDraft = () => {
    setApiError('');
    deleteDraftInvoice.mutate(invoice.id, {
      onSuccess: () => navigate(-1),
      onError:   (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
    });
  };

  const canEditDeposit = invoice.kind === 'deposit' && isDraft && canUpdate;

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
          {canEditDeposit && !showEditForm && (
            <button
              onClick={openEditForm}
              className="p-3 border border-stone-200 rounded-xl hover:bg-stone-50 text-on-surface-variant transition-all flex items-center gap-2 bg-white"
            >
              <SquarePen className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">{t('common.edit')}</span>
            </button>
          )}
          {isDraft && canDeleteDraft && (
            <button
              onClick={() => setConfirmDeleteDraft(true)}
              disabled={deleteDraftInvoice.isPending}
              className="p-3 border border-red-200 rounded-xl hover:bg-red-50 text-red-600 transition-all flex items-center gap-2 bg-white disabled:opacity-50"
              title={t('invoice.deleteDraftHint')}
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">{t('invoice.deleteDraft')}</span>
            </button>
          )}
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

      {canEditDeposit && showEditForm && (
        <div className="no-print bg-white rounded-3xl border border-stone-200 p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.amount')}</label>
            <input
              type="number" min={1} value={editAmount}
              onChange={e => setEditAmount(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">Notes</label>
            <input
              type="text" value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3">
            <button onClick={() => setShowEditForm(false)}
              className="px-4 py-2.5 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-stone-50 transition-colors">
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={!editAmount || parseInt(editAmount, 10) <= 0 || updateInvoice.isPending}
              className="px-4 py-2.5 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {updateInvoice.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div
        id="invoice-print-area"
        className="lg:col-span-2 bg-white p-8 md:p-14 rounded-3xl shadow-sm border border-stone-200 flex flex-col gap-10"
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
          {(invoice.kind === 'deposit' || isRefundDoc) && totalPaid > 0 && (
            <div className="flex items-center gap-16 text-[10px] font-bold uppercase tracking-widest text-teal-600">
              <span>{isRefundDoc ? t('invoice.refunded') : t('invoice.status_paid')}</span>
              <span className="font-mono">-{fmtAmount(totalPaid)}</span>
            </div>
          )}
          {(invoice.kind === 'deposit' || isRefundDoc) && remaining > 0 && !isDraft && (
            <div className="flex items-center gap-16 text-[10px] font-bold uppercase tracking-widest text-red-600">
              <span>{isRefundDoc ? t('invoice.remainingToRefund') : t('invoice.remaining')}</span>
              <span className="font-mono">{fmtAmount(remaining)}</span>
            </div>
          )}
        </div>

        {invoice.notes && (
          <p className="text-[10px] text-on-surface-variant/50 italic border-t border-stone-100 pt-4">{invoice.notes}</p>
        )}
      </div>

      {/* ── Sidebar : mouvement d'argent — encaissement pour un acompte, remboursement pour un
          avoir visé (hidden on print) ── */}
      {(invoice.kind === 'deposit' || isRefundDoc) && (
        <div className="no-print space-y-6">
          {nothingToRefund && (
            <div className="bg-white rounded-3xl border border-stone-200 p-6 flex items-start gap-3 text-on-surface-variant/70">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">{t('invoice.nothingToRefund')}</p>
            </div>
          )}
          {canReceivePayment && canRecordPayment && (
            <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
              <div className="p-6 border-b border-stone-100 flex justify-between items-center flex-wrap gap-3">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{isRefundDoc ? t('invoice.recordRefund') : t('invoice.recordPayment')}</h4>
                <button
                  onClick={() => setShowPayForm(v => !v)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 text-primary rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isRefundDoc ? t('invoice.recordRefund') : t('invoice.recordPayment')}
                </button>
              </div>
              {showPayForm && (
                <div className="p-6 grid grid-cols-1 gap-4 border-b border-stone-100">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.amount')}</label>
                    <input
                      type="number" min={1} value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      placeholder={String(remaining)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.method')}</label>
                    <select
                      value={payMethod}
                      onChange={e => { setPayMethod(e.target.value as PaymentMethod); setPayAccountId(''); }}
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
                      value={selectedAccountId}
                      onChange={e => setPayAccountId(e.target.value)}
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
                      type="text" value={payReference}
                      onChange={e => setPayReference(e.target.value)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">Notes</label>
                    <input
                      type="text" value={payNotes}
                      onChange={e => setPayNotes(e.target.value)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setShowPayForm(false)}
                      className="px-4 py-2.5 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-stone-50 transition-colors">
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleRecordPayment}
                      disabled={!payAmount || !selectedAccountId || recordPayment.isPending || (isRefundDoc && parseInt(payAmount, 10) > remaining)}
                      className="px-4 py-2.5 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {recordPayment.isPending ? t('common.saving') : t('common.confirm')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
            <div className="p-6 border-b border-stone-100">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{isRefundDoc ? t('invoice.refundHistory') : t('invoice.paymentHistory')}</h4>
            </div>
            {invoice.payments.length === 0 ? (
              <div className="p-10 text-center text-xs text-on-surface-variant/40">{isRefundDoc ? t('invoice.noRefunds') : t('invoice.noPayments')}</div>
            ) : (
              <div className="divide-y divide-stone-100">
                {invoice.payments.map(p => (
                  <div key={p.id} className="p-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                        <CreditCard className="w-4 h-4 text-stone-500" />
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col gap-1">
                        <p className="text-sm font-bold text-stone-900 tracking-tight">{fmtAmount(p.amount)}</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-stone-500 flex-wrap leading-relaxed">
                          <span className="font-medium text-stone-700">{t(`invoice.method_${p.method}`)}</span>
                          <span className="text-stone-300">•</span>
                          <span>{p.account.name}</span>
                          <span className="text-stone-300">•</span>
                          <span>{fmtDate(p.paidAt)}</span>
                        </div>
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
      )}
      </div>

      <ConfirmModal
        isOpen={isConfirmRefundModalOpen}
        onClose={() => setConfirmRefundModalOpen(false)}
        onConfirm={() => { handleVoidPayment(); setConfirmRefundModalOpen(false); }}
        title={t('invoice.cancelTitle')}
        message={t('invoice.cancelMessage')}
        confirmLabel={t('invoice.confirmCancel')}
        isPending={voidPayment.isPending}
      />
      <ConfirmModal
        isOpen={confirmDeleteDraft}
        onClose={() => setConfirmDeleteDraft(false)}
        onConfirm={() => { handleDeleteDraft(); setConfirmDeleteDraft(false); }}
        title={t('invoice.deleteDraftTitle')}
        message={t('invoice.deleteDraftMessage')}
        confirmLabel={t('invoice.deleteDraft')}
        isPending={deleteDraftInvoice.isPending}
      />
    </motion.div>
  );
};
