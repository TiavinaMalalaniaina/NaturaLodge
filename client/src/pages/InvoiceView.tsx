import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Printer, Plus, AlertCircle, Trash2, ShieldCheck, PiggyBank, FileText, ChevronRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import {
  useInvoiceByBooking, useGenerateInvoice, useRecordPayment, useVoidPayment,
  useValidateInvoice, useDeleteDraftInvoice, useCreateDeposit, useInvoices,
  useAddInvoiceItem, useDeleteInvoiceItem, useAddInvoiceDiscount,
} from '../hooks/useInvoices';
import { useCashAccounts } from '../hooks/useLedger';
import { PaymentMethod } from '../api/invoices';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/QueryLoader';
import { formatCurrency as fmtAmount, todayLocalStr } from '../lib/format';
import { INVOICE_STATUS_CLASS as STATUS_CLASS, invoiceStatusI18nKey } from '../lib/statusColors';
import { getApiErrorMessage } from '../lib/apiError';
import { ConfirmModal } from '../components/ConfirmModal';
import { InvoiceDocumentCard, MoneyRow } from '../components/invoice/InvoiceDocumentCard';
import { InvoicePaymentForm } from '../components/invoice/InvoicePaymentForm';
import { InvoicePaymentHistory } from '../components/invoice/InvoicePaymentHistory';

const ADJUSTMENT_TYPES = ["charge", "discount"] as const;
const DISCOUNT_TYPES = ["percent", "fixed"] as const;

export const InvoiceView: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { can } = useAuth();

  const { data: invoice, isLoading, isError } = useInvoiceByBooking(bookingId ?? null);
  const generateInvoice = useGenerateInvoice();
  const recordPayment = useRecordPayment();
  const voidPayment = useVoidPayment();
  const validateInvoice = useValidateInvoice();
  const deleteDraftInvoice = useDeleteDraftInvoice();
  const createDeposit = useCreateDeposit();
  const { data: documentsList } = useInvoices(bookingId ? { bookingId, limit: 50 } : undefined);
  const addInvoiceItem = useAddInvoiceItem();
  const deleteInvoiceItem = useDeleteInvoiceItem();
  const addInvoiceDiscount = useAddInvoiceDiscount();

  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState('');
  const [dueAt] = useState(() => todayLocalStr());

  const { data: cashAccounts } = useCashAccounts();

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payAccountId, setPayAccountId] = useState('');
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [showPayForm, setShowPayForm] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isConfirmRefundModalOpen, setConfirmRefundModalOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [confirmDeleteDraft, setConfirmDeleteDraft] = useState(false);

  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositNotes, setDepositNotes] = useState('');

  const [showItemForm, setShowItemForm] = useState(false);
  const [addMode, setAddMode] = useState<'charge' | 'discount'>('charge');
  const [discountKind, setDiscountKind] = useState<'percent' | 'fixed'>('percent');
  const [itemDesc, setItemDesc] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemPrice, setItemPrice] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const resetItemForm = () => {
    setShowItemForm(false);
    setAddMode('charge');
    setDiscountKind('percent');
    setItemDesc('');
    setItemQty('1');
    setItemPrice('');
  };

  // Filtre le sélecteur de compte selon la méthode choisie (ex: Mvola -> seul le compte Mvola) —
  // repli sur tous les comptes si aucun n'est associé à cette méthode (ex: carte/virement, pas
  // encore de banque configurée) pour ne jamais bloquer l'enregistrement d'un paiement.
  const accountsForMethod = (cashAccounts ?? []).filter(a => a.allowedMethods.includes(payMethod));
  const availableAccounts = accountsForMethod.length > 0 ? accountsForMethod : (cashAccounts ?? []);
  const selectedAccountId = payAccountId || availableAccounts[0]?.id || '';

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
    if (!amount || amount <= 0 || !selectedAccountId) return;
    setApiError('');
    recordPayment.mutate(
      { invoiceId: invoice.id, amount, method: payMethod, accountId: selectedAccountId, reference: payReference || undefined, notes: payNotes || undefined },
      {
        onSuccess: () => {
          setPayAmount('');
          setPayAccountId('');
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

  const handleValidate = () => {
    if (!invoice) return;
    setApiError('');
    validateInvoice.mutate(invoice.id, {
      onError: (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
    });
  };

  const handleDeleteDraft = () => {
    if (!invoice) return;
    setApiError('');
    deleteDraftInvoice.mutate(invoice.id, {
      onSuccess: () => navigate(bookingId ? `/reservations/${bookingId}` : '/invoices'),
      onError:   (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
    });
  };

  const handleCreateDeposit = () => {
    if (!bookingId) return;
    const amount = parseInt(depositAmount, 10);
    if (!amount || amount <= 0) return;
    setApiError('');
    createDeposit.mutate(
      { bookingId, amount, notes: depositNotes || undefined },
      {
        onSuccess: (created) => {
          setDepositAmount(''); setDepositNotes(''); setShowDepositForm(false);
          navigate(`/invoices/document/${created.id}`);
        },
        onError:   (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
      },
    );
  };

  const handleAddItem = () => {
    if (!invoice) return;
    const quantity = parseInt(itemQty, 10);
    const unitPrice = parseInt(itemPrice, 10);
    if (!itemDesc.trim() || !quantity || quantity <= 0 || Number.isNaN(unitPrice)) return;
    setApiError('');
    addInvoiceItem.mutate(
      { invoiceId: invoice.id, description: itemDesc.trim(), quantity, unitPrice },
      {
        onSuccess: resetItemForm,
        onError: (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
      },
    );
  };

  const handleAddDiscount = () => {
    if (!invoice) return;
    const value = parseInt(itemPrice, 10);
    if (!value || value <= 0) return;
    if (discountKind === 'percent' && value > 100) return;
    setApiError('');
    addInvoiceDiscount.mutate(
      { invoiceId: invoice.id, mode: discountKind, value, label: itemDesc.trim() || undefined },
      {
        onSuccess: resetItemForm,
        onError: (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
      },
    );
  };

  const handleDeleteItem = () => {
    if (!invoice || !itemToDelete) return;
    setApiError('');
    deleteInvoiceItem.mutate({ invoiceId: invoice.id, itemId: itemToDelete }, {
      onError: (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
    });
  };

  const canGenerate = can('invoices.generate');
  const canRecordPayment = can('invoices.record_payment');
  const canVoid = can('invoices.void_payment');
  const canValidate = can('invoices.validate');
  const canDeleteDraft = can('invoices.delete_draft');
  const canIssueDeposit = can('invoices.issue_deposit');
  const canEditItems = can('invoices.update') && !!invoice && invoice.status !== 'cancelled' && invoice.status !== 'refunded';
  const noInvoice = !isLoading && (isError || !invoice);
  const isDraft = !!invoice && !invoice.validatedAt;

  const totalPaid = invoice
    ? invoice.payments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0)
    : 0;
  const remaining = invoice ? Math.max(0, invoice.totalAmount - totalPaid) : 0;
  // Une facture doit être visée avant de pouvoir recevoir un paiement (voir invoice.service.ts:
  // addPayment) — tant qu'elle est brouillon, aucun encaissement n'est possible.
  const canReceivePayment = invoice && !isDraft && invoice.status !== 'paid' && invoice.status !== 'cancelled';

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
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 font-mono">{invoice.number ?? t('invoice.draft')}</p>
                {isDraft ? (
                  <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border bg-amber-50 text-amber-700 border-amber-200">
                    {t('invoice.draft')}
                  </span>
                ) : (
                  <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border', STATUS_CLASS[invoice.status])}>
                    {t(`invoice.status_${invoice.status}`)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isDraft && canDeleteDraft && (
            <button
              onClick={() => setConfirmDeleteDraft(true)}
              disabled={deleteDraftInvoice.isPending}
              className="p-3 border border-red-200 rounded-xl hover:bg-red-50 text-red-600 transition-all flex items-center gap-2 bg-white disabled:opacity-50"
              title={t('invoice.deleteDraftHint')}
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">
                {t('invoice.deleteDraft')}
              </span>
            </button>
          )}
          {isDraft && canValidate && (
            <button
              onClick={handleValidate}
              disabled={validateInvoice.isPending}
              className="p-3 border border-primary/30 rounded-xl hover:bg-primary/5 text-primary transition-all flex items-center gap-2 bg-white disabled:opacity-50"
              title={t('invoice.validateHint')}
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">
                {validateInvoice.isPending ? t('common.saving') : t('invoice.validate')}
              </span>
            </button>
          )}
          {invoice && (
            <button
              onClick={() => window.print()}
              className="p-3 border border-stone-200 rounded-xl hover:bg-stone-50 text-on-surface-variant transition-all flex items-center gap-2 bg-white"
            >
              <Printer className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">{t('common.print')}</span>
            </button>
          )}
        </div>
      </div>

      {isDraft && (
        <div className="no-print flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-xs font-medium">{t('invoice.draftHint')}</p>
        </div>
      )}

      {apiError && (
        <div className="no-print flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-xs font-medium">{apiError}</p>
        </div>
      )}

      {/* Pas de facture STANDARD : le formulaire de génération est l'action principale, affiché
          avant la section acompte / documents (secondaire). */}
      {noInvoice && (
        <div className="bg-white rounded-3xl border border-stone-200 p-10 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-on-surface-variant/30" />
          </div>
          <div>
            <p className="font-semibold text-on-surface">{t('invoice.noInvoice')}</p>
            <p className="text-xs text-on-surface-variant/50 mt-1">{t('invoice.noInvoiceHint')}</p>
          </div>

          {canGenerate && (
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
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('common.notes')}</label>
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

      {/* Acompte + liste des documents de la réservation — un acompte se prend typiquement avant
          même de générer la facture, d'où l'indépendance vis-à-vis de la facture STANDARD. */}
      {(canIssueDeposit || (documentsList?.data.length ?? 0) > 0) && (
        <div className="no-print grid grid-cols-1 lg:grid-cols-2 gap-6">
          {canIssueDeposit && (
            <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
              <div className="p-6 border-b border-stone-100 flex justify-between items-center flex-wrap gap-3">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{t('invoice.deposit')}</h4>
                <button
                  onClick={() => setShowDepositForm(v => !v)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 text-primary rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-colors"
                >
                  <PiggyBank className="w-3.5 h-3.5" />
                  {t('invoice.issueDeposit')}
                </button>
              </div>
              {showDepositForm && (
                <div className="p-6 grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.amount')}</label>
                    <input
                      type="number" min={1} value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('common.notes')}</label>
                    <input
                      type="text" value={depositNotes}
                      onChange={e => setDepositNotes(e.target.value)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setShowDepositForm(false)}
                      className="px-4 py-2.5 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-stone-50 transition-colors">
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleCreateDeposit}
                      disabled={!depositAmount || createDeposit.isPending}
                      className="px-4 py-2.5 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {createDeposit.isPending ? t('common.saving') : t('common.confirm')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {(documentsList?.data.length ?? 0) > 0 && (
            <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
              <div className="p-6 border-b border-stone-100">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{t('bookingDetail.allDocuments')}</h4>
              </div>
              <div className="divide-y divide-stone-100">
                {documentsList!.data.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => navigate(doc.kind === 'standard' ? `/invoices/${doc.bookingId}` : `/invoices/document/${doc.id}`)}
                    className="w-full p-4 flex items-center justify-between gap-3 hover:bg-stone-50 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-on-surface-variant/40 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-on-surface font-mono truncate">{doc.number ?? t('invoice.draft')}</p>
                        <p className="text-[9px] uppercase tracking-widest text-on-surface-variant/40">
                          {t(`invoice.kind_${doc.kind}`)} · {!doc.validatedAt ? t('invoice.draft') : t(invoiceStatusI18nKey(doc.kind, doc.status))}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-xs font-mono font-semibold text-on-surface">{fmtAmount(doc.totalAmount)}</p>
                      <ChevronRight className="w-4 h-4 text-on-surface-variant/30 group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invoice document — jamais rendu si la requête est en erreur (404 = pas de facture STANDARD),
          même si `invoice` porte encore une valeur périmée en cache. */}
      {!noInvoice && invoice && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:block">
          <InvoiceDocumentCard
            invoice={invoice}
            isDraft={isDraft}
            movementRows={[
              ...(totalPaid > 0 ? [{ label: t('invoice.status_paid'), value: `-${fmtAmount(totalPaid)}`, accent: 'pos' as const }] : []),
              ...(remaining > 0 ? [{ label: t('invoice.remaining'), value: fmtAmount(remaining), accent: 'neg' as const }] : []),
            ] satisfies MoneyRow[]}
            canEditItems={canEditItems}
            onDeleteItem={id => setItemToDelete(id)}
            isDeletingItem={deleteInvoiceItem.isPending}
            itemsFooter={canEditItems ? (
              !showItemForm ? (
                <button
                  onClick={() => setShowItemForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 text-primary rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('invoice.addItem')}
                </button>
              ) : (
                <div className="flex flex-col gap-3 p-4 bg-stone-50 border border-stone-200 rounded-xl">
                  {/* Charge / Remise */}
                  <div className="flex gap-1 p-1 bg-white border border-stone-200 rounded-xl w-fit">
                    {ADJUSTMENT_TYPES.map(m => (
                      <button
                        key={m}
                        onClick={() => setAddMode(m)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors',
                          addMode === m ? 'bg-primary text-white' : 'text-on-surface-variant/60 hover:bg-stone-50',
                        )}
                      >
                        {t(m === 'charge' ? 'invoice.addCharge' : 'invoice.addDiscount')}
                      </button>
                    ))}
                  </div>

                  {addMode === 'charge' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.itemDescription')}</label>
                        <input
                          type="text"
                          value={itemDesc}
                          onChange={e => setItemDesc(e.target.value)}
                          placeholder={t('invoice.itemDescriptionHint')}
                          className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                      <div className="sm:w-20">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.itemQuantity')}</label>
                        <input
                          type="number"
                          min={1}
                          value={itemQty}
                          onChange={e => setItemQty(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                      <div className="sm:w-32">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.itemUnitPrice')}</label>
                        <input
                          type="number"
                          value={itemPrice}
                          onChange={e => setItemPrice(e.target.value)}
                          placeholder="0"
                          className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                      <p className="sm:col-span-3 text-[10px] text-on-surface-variant/50 -mt-1">{t('invoice.itemHint')}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.discountKind')}</label>
                        <div className="flex gap-1 p-1 bg-white border border-stone-200 rounded-xl">
                          {DISCOUNT_TYPES.map(k => (
                            <button
                              key={k}
                              onClick={() => setDiscountKind(k)}
                              className={cn(
                                'px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors',
                                discountKind === k ? 'bg-emerald-600 text-white' : 'text-on-surface-variant/60 hover:bg-stone-50',
                              )}
                            >
                              {t(k === 'percent' ? 'invoice.discountPercent' : 'invoice.discountFixed')}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('invoice.discountLabelOptional')}</label>
                        <input
                          type="text"
                          value={itemDesc}
                          onChange={e => setItemDesc(e.target.value)}
                          placeholder={discountKind === 'percent' ? t('invoice.discountLabelHintPct') : t('invoice.discountLabelHintFixed')}
                          className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                      <div className="sm:w-32">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">
                          {discountKind === 'percent' ? t('invoice.discountValuePercent') : t('invoice.discountValueFixed')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={discountKind === 'percent' ? 100 : undefined}
                          value={itemPrice}
                          onChange={e => setItemPrice(e.target.value)}
                          placeholder={discountKind === 'percent' ? '10' : '0'}
                          className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                      <p className="sm:col-span-3 text-[10px] text-on-surface-variant/50 -mt-1">{t('invoice.discountHint')}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={resetItemForm}
                      className="px-4 py-2.5 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-stone-50 transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    {addMode === 'charge' ? (
                      <button
                        onClick={handleAddItem}
                        disabled={!itemDesc.trim() || !itemPrice || addInvoiceItem.isPending}
                        className="px-4 py-2.5 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {addInvoiceItem.isPending ? t('common.saving') : t('common.confirm')}
                      </button>
                    ) : (
                      <button
                        onClick={handleAddDiscount}
                        disabled={!itemPrice || parseInt(itemPrice, 10) <= 0 || (discountKind === 'percent' && parseInt(itemPrice, 10) > 100) || addInvoiceDiscount.isPending}
                        className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-600/90 transition-colors disabled:opacity-50"
                      >
                        {addInvoiceDiscount.isPending ? t('common.saving') : t('common.confirm')}
                      </button>
                    )}
                  </div>
                </div>
              )
            ) : undefined}
          />

          {/* ── Sidebar: payments (1/3, hidden on print) ── */}
          <div className="no-print space-y-6">
            {canReceivePayment && canRecordPayment && (
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
                    submitDisabled={!payAmount || !selectedAccountId}
                  />
                )}
              </div>
            )}

            <InvoicePaymentHistory
              title={t('invoice.paymentHistory')}
              emptyText={t('invoice.noPayments')}
              payments={invoice.payments}
              canVoid={canVoid}
              onVoidRequest={id => { setSelectedPaymentId(id); setConfirmRefundModalOpen(true); }}
              isVoiding={voidPayment.isPending}
            />
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
      <ConfirmModal
        isOpen={itemToDelete !== null}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => { handleDeleteItem(); setItemToDelete(null); }}
        title={t('invoice.removeItemTitle')}
        message={t('invoice.removeItemMessage')}
        confirmLabel={t('invoice.removeItem')}
        isPending={deleteInvoiceItem.isPending}
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
