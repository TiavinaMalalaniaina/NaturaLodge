import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Printer, ShieldCheck, AlertCircle, Plus, Trash2, SquarePen } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { useInvoice, useValidateInvoice, useRecordPayment, useVoidPayment, useUpdateInvoice, useDeleteDraftInvoice } from '../hooks/useInvoices';
import { useCashAccounts } from '../hooks/useLedger';
import { PaymentMethod } from '../api/invoices';
import { useAuth } from '../context/AuthContext';
import { PageLoader, PageError } from '../components/QueryLoader';
import { formatCurrency as fmtAmount } from '../lib/format';
import { INVOICE_STATUS_CLASS, invoiceStatusI18nKey } from '../lib/statusColors';
import { getApiErrorMessage } from '../lib/apiError';
import { ConfirmModal } from '../components/ConfirmModal';
import { InvoiceDocumentCard, MoneyRow } from '../components/invoice/InvoiceDocumentCard';
import { InvoicePaymentForm } from '../components/invoice/InvoicePaymentForm';
import { InvoicePaymentHistory } from '../components/invoice/InvoicePaymentHistory';

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
              {isDraft ? (
                <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border bg-amber-50 text-amber-700 border-amber-200">
                  {t('invoice.draft')}
                </span>
              ) : (
                <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border', INVOICE_STATUS_CLASS[invoice.status])}>
                  {t(invoiceStatusI18nKey(invoice.kind, invoice.status))}
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
            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">{t('common.print')}</span>
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
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('common.notes')}</label>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:block">
        <InvoiceDocumentCard
          invoice={invoice}
          isDraft={isDraft}
          movementRows={[
            ...((invoice.kind === 'deposit' || isRefundDoc) && totalPaid > 0
              ? [{ label: isRefundDoc ? t('invoice.refunded') : t('invoice.status_paid'), value: `-${fmtAmount(totalPaid)}`, accent: 'pos' as const }]
              : []),
            ...((invoice.kind === 'deposit' || isRefundDoc) && remaining > 0 && !isDraft
              ? [{ label: isRefundDoc ? t('invoice.remainingToRefund') : t('invoice.remaining'), value: fmtAmount(remaining), accent: 'neg' as const }]
              : []),
          ] satisfies MoneyRow[]}
        />

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
                  <InvoicePaymentForm
                    amount={payAmount} onAmountChange={setPayAmount} amountPlaceholder={String(remaining)}
                    method={payMethod} onMethodChange={m => { setPayMethod(m); setPayAccountId(''); }}
                    accountId={selectedAccountId} onAccountChange={setPayAccountId}
                    availableAccounts={availableAccounts}
                    reference={payReference} onReferenceChange={setPayReference}
                    notes={payNotes} onNotesChange={setPayNotes}
                    onCancel={() => setShowPayForm(false)}
                    onSubmit={handleRecordPayment}
                    isPending={recordPayment.isPending}
                    submitDisabled={!payAmount || !selectedAccountId || (isRefundDoc && parseInt(payAmount, 10) > remaining)}
                  />
                )}
              </div>
            )}

            <InvoicePaymentHistory
              title={isRefundDoc ? t('invoice.refundHistory') : t('invoice.paymentHistory')}
              emptyText={isRefundDoc ? t('invoice.noRefunds') : t('invoice.noPayments')}
              payments={invoice.payments}
              canVoid={canVoid}
              onVoidRequest={id => { setSelectedPaymentId(id); setConfirmRefundModalOpen(true); }}
              isVoiding={voidPayment.isPending}
            />
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
