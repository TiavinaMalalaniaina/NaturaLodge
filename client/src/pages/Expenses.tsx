import React, { useState } from 'react';
import { Receipt, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useExpenses } from '../hooks/useExpenses';
import { PageLoader, PageError } from '../components/QueryLoader';
import { CreateExpenseModal } from '../components/CreateExpenseModal';
import { ExpenseCategory } from '../api/expenses';
import { formatDate, formatCurrency, startOfDayIso, endOfDayIso } from '../lib/format';
import { useAuth } from '../context/AuthContext';

type CategoryFilter = 'all' | ExpenseCategory;

export const Expenses: React.FC = () => {
  const { t } = useTranslation();
  const { can } = useAuth();

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [isCreateOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isError } = useExpenses({
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    dateFrom: dateFrom ? startOfDayIso(dateFrom) : undefined,
    dateTo:   dateTo   ? endOfDayIso(dateTo)     : undefined,
    page,
    limit: 20,
  });

  const expenses = data?.data ?? [];
  const meta      = data?.meta;

  const CATEGORY_TABS: { key: CategoryFilter; label: string }[] = [
    { key: 'all',         label: t('common.all') },
    { key: 'supplies',    label: t('expenses.category_supplies') },
    { key: 'utilities',   label: t('expenses.category_utilities') },
    { key: 'maintenance', label: t('expenses.category_maintenance') },
    { key: 'marketing',   label: t('expenses.category_marketing') },
    { key: 'salaries',    label: t('expenses.category_salaries') },
    { key: 'other',       label: t('expenses.category_other') },
  ];

  if (isLoading) return <PageLoader />;
  if (isError)   return <PageError />;

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="font-display italic text-3xl md:text-4xl text-primary leading-none">{t('expenses.title')}</h2>
          <p className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-[0.2em] mt-2">
            {t('expenses.count', { count: meta?.total ?? expenses.length })}
          </p>
        </div>
        {can('expenses.create') && (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-black/10"
          >
            <Plus className="w-4 h-4" />
            {t('expenses.record')}
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setCategoryFilter(tab.key); setPage(1); }}
              className={cn(
                'px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all',
                categoryFilter === tab.key
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-white text-on-surface-variant border-stone-200 hover:border-primary/30',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('expenses.from')}</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('expenses.to')}</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
              className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 hover:text-primary transition-colors">
              {t('common.clear')}
            </button>
          )}
        </div>
      </div>

      {/* ── List ── */}
      {expenses.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-16 text-center">
          <Receipt className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-4 stroke-1" />
          <p className="text-sm font-medium text-on-surface-variant/50">{t('expenses.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white rounded-2xl border border-stone-200 p-5 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4 text-on-surface-variant/50" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-on-surface truncate">{e.description}</p>
                    <span className="px-2 py-0.5 rounded-full bg-stone-100 text-[9px] font-bold text-on-surface-variant/60 uppercase tracking-widest shrink-0">
                      {t(`expenses.category_${e.category}`)}
                    </span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant/50 mt-0.5 truncate">
                    {e.paidFrom.name} · {formatDate(e.incurredAt)}
                    {e.approvedBy && <> · {e.approvedBy.name}</>}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-on-surface">−{formatCurrency(e.amount)}</p>
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

      <CreateExpenseModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};
