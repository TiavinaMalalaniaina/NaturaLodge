import React, { useState } from 'react';
import { FileText, Search, X, ChevronRight, CreditCard } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvoices } from '../hooks/useInvoices';
import { PageLoader, PageError } from '../components/QueryLoader';
import { InvoiceStatus } from '../api/invoices';
import { EFFECTIVE_STATUS_CLASS, EFFECTIVE_STATUS_I18N_KEY } from '../lib/bookingStatus';

type StatusFilter = 'all' | InvoiceStatus;

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

export const Invoices: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);

  const { data, isLoading, isError } = useInvoices({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    page,
    limit: 20,
  });

  const invoices = data?.data ?? [];
  const meta     = data?.meta;

  const filtered = search
    ? invoices.filter(inv =>
        inv.number.toLowerCase().includes(search.toLowerCase()) ||
        inv.booking.guest.name.toLowerCase().includes(search.toLowerCase()),
      )
    : invoices;

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all',            label: t('common.all') },
    { key: 'pending',        label: t('invoice.status_pending') },
    { key: 'partially_paid', label: t('invoice.status_partially_paid') },
    { key: 'paid',           label: t('invoice.status_paid') },
    { key: 'refunded',       label: t('invoice.status_refunded') },
    { key: 'cancelled',      label: t('invoice.status_cancelled') },
  ];

  // Une facture STANDARD reste adressée par réservation (route historique). Un acompte ou un avoir
  // est un document à part entière, adressé par son propre id (voir /invoices/document/:invoiceId).
  const handleOpen = (inv: { kind: string; id: string; bookingId: string }) => {
    navigate(inv.kind === 'standard' ? `/invoices/${inv.bookingId}` : `/invoices/document/${inv.id}`);
  };

  if (isLoading) return <PageLoader />;
  if (isError)   return <PageError />;

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="font-display italic text-3xl md:text-4xl text-primary leading-none">{t('invoices.title')}</h2>
          <p className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-[0.2em] mt-2">
            {t('invoices.count', { count: meta?.total ?? filtered.length })}
          </p>
        </div>
        <button
          onClick={() => navigate('/payments')}
          className="w-full sm:w-auto bg-stone-100 text-on-surface-variant px-6 py-3 rounded-xl font-sans text-xs font-bold tracking-[0.2em] uppercase hover:bg-stone-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <CreditCard className="w-4 h-4" /> {t('payments.title')}
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={cn(
                'px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all',
                statusFilter === tab.key
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-white text-on-surface-variant border-stone-200 hover:border-primary/30',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('invoices.search')}
            className="w-full pl-11 pr-10 py-3 bg-white border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-stone-100">
              <X className="w-3.5 h-3.5 text-on-surface-variant/50" />
            </button>
          )}
        </div>
      </div>

      {/* ── List ── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-16 text-center">
          <FileText className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-4 stroke-1" />
          <p className="text-sm font-medium text-on-surface-variant/50">{t('invoices.noInvoices')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv, i) => {
            const totalPaid = inv.payments
              .filter(p => p.status === 'completed')
              .reduce((s, p) => s + p.amount, 0);
            const remaining = Math.max(0, inv.totalAmount - totalPaid);

            return (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => handleOpen(inv)}
                className="bg-white rounded-2xl border border-stone-200 p-5 flex items-center justify-between gap-4 hover:border-primary/30 hover:shadow-sm cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-on-surface-variant/50" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-on-surface font-mono">{inv.number ?? t('invoice.draft')}</p>
                      {inv.kind !== 'standard' && (
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border bg-stone-50 text-on-surface-variant border-stone-200">
                          {t(`invoice.kind_${inv.kind}`)}
                        </span>
                      )}
                      <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border', STATUS_CLASS[inv.status])}>
                        {t(`invoice.status_${inv.status}`)}
                      </span>
                      {inv.booking.effectiveStatus && (
                        <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border', EFFECTIVE_STATUS_CLASS[inv.booking.effectiveStatus])}>
                          {t(EFFECTIVE_STATUS_I18N_KEY[inv.booking.effectiveStatus])}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-on-surface-variant/50 mt-0.5 truncate">
                      {inv.booking.guest.name} · {fmtDate(inv.issuedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-on-surface">{fmtAmount(inv.totalAmount)}</p>
                    {remaining > 0 && inv.status !== 'cancelled' && (
                      <p className="text-[10px] text-red-500 font-mono mt-0.5">
                        {t('invoice.remaining')}: {fmtAmount(remaining)}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-on-surface-variant/30 group-hover:text-primary transition-colors" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={!meta.hasPrevPage}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 hover:border-primary/30 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-[10px] font-bold text-on-surface-variant/50">
            {t('common.page')} {meta.page} {t('common.of')} {meta.totalPages}
          </span>
          <button
            disabled={!meta.hasNextPage}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 hover:border-primary/30 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
