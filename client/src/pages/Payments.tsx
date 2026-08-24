import React, { useState } from 'react';
import { CreditCard, Search, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '../hooks/useDebounce';
import { usePayments } from '../hooks/usePayments';
import { PageLoader, PageError } from '../components/QueryLoader';
import { PaymentMethod, PaymentStatus } from '../api/invoices';
import { formatDate, formatCurrency } from '../lib/format';

type StatusFilter = 'all' | PaymentStatus;
type MethodFilter = 'all' | PaymentMethod;

const STATUS_CLASS: Record<PaymentStatus, string> = {
  completed: 'bg-teal-50 text-teal-700 border-teal-200',
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  failed:    'bg-red-50 text-red-600 border-red-200',
  refunded:  'bg-purple-50 text-purple-700 border-purple-200',
};

export const Payments: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);

  const debouncedSearch = useDebounce(search);

  const { data, isLoading, isError } = usePayments({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    method: methodFilter !== 'all' ? methodFilter : undefined,
    search: debouncedSearch || undefined,
    page,
    limit: 20,
  });

  const payments = data?.data ?? [];
  const meta      = data?.meta;

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all',       label: t('common.all') },
    { key: 'completed', label: t('payments.status_completed') },
    { key: 'pending',   label: t('payments.status_pending') },
    { key: 'failed',    label: t('payments.status_failed') },
    { key: 'refunded',  label: t('payments.status_refunded') },
  ];

  const METHOD_TABS: { key: MethodFilter; label: string }[] = [
    { key: 'all',           label: t('common.all') },
    { key: 'cash',          label: t('invoice.method_cash') },
    { key: 'card',          label: t('invoice.method_card') },
    { key: 'bank_transfer', label: t('invoice.method_bank_transfer') },
    { key: 'online',        label: t('invoice.method_online') },
    { key: 'mvola',         label: t('invoice.method_mvola') },
    { key: 'orange_money',  label: t('invoice.method_orange_money') },
  ];

  if (isLoading) return <PageLoader />;
  if (isError)   return <PageError />;

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="font-display italic text-3xl md:text-4xl text-primary leading-none">{t('payments.title')}</h2>
          <p className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-[0.2em] mt-2">
            {t('payments.count', { count: meta?.total ?? payments.length })}
          </p>
        </div>
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

        <div className="flex gap-2 flex-wrap">
          {METHOD_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setMethodFilter(tab.key); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all',
                methodFilter === tab.key
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-on-surface-variant/60 border-stone-200 hover:border-stone-400',
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
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('payments.search')}
            className="w-full pl-11 pr-10 py-3 bg-white border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-stone-100">
              <X className="w-3.5 h-3.5 text-on-surface-variant/50" />
            </button>
          )}
        </div>
      </div>

      {/* ── List ── */}
      {payments.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-16 text-center">
          <CreditCard className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-4 stroke-1" />
          <p className="text-sm font-medium text-on-surface-variant/50">{t('payments.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/invoices/${p.invoice.bookingId}`)}
              className="bg-white rounded-2xl border border-stone-200 p-5 flex items-center justify-between gap-4 hover:border-primary/30 hover:shadow-sm cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4 text-on-surface-variant/50" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-on-surface">{p.invoice.guest.name}</p>
                    <span className="px-2 py-0.5 rounded-full bg-stone-100 text-[9px] font-mono font-bold text-on-surface-variant/60 uppercase tracking-widest">
                      {p.invoice.number}
                    </span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant/50 mt-0.5 truncate">
                    {t(`invoice.method_${p.method}`)} · {formatDate(p.paidAt)} · {p.processedBy.name}
                    {p.reference && <> · #{p.reference}</>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-on-surface">{formatCurrency(p.amount)}</p>
                </div>
                <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border shrink-0', STATUS_CLASS[p.status])}>
                  {t(`payments.status_${p.status}`)}
                </span>
              </div>
            </motion.div>
          ))}
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
