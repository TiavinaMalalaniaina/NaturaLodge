import React, { useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, PiggyBank, Settings2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCashAccounts, useCashAccountGroups, useLedgerEntries, useLedgerSummary } from '../hooks/useLedger';
import { PageLoader, PageError } from '../components/QueryLoader';
import { CreateTransferModal } from '../components/CreateTransferModal';
import { CreateContributionModal } from '../components/CreateContributionModal';
import { formatDate, formatCurrency, dateToLocalStr, todayLocalStr, startOfDayIso, endOfDayIso } from '../lib/format';
import { useAuth } from '../context/AuthContext';

const firstOfMonth = () => {
  const now = new Date();
  return dateToLocalStr(new Date(now.getFullYear(), now.getMonth(), 1));
};

export const Treasury: React.FC = () => {
  const { t } = useTranslation();
  const { can } = useAuth();
  const navigate = useNavigate();

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo,   setDateTo]   = useState(todayLocalStr());
  const [page, setPage] = useState(1);
  const [isTransferOpen, setTransferOpen] = useState(false);
  const [isContributionOpen, setContributionOpen] = useState(false);

  // Le relevé d'un compte de trésorerie (virements, dépenses, encaissements) suit la visibilité du
  // compte : accessible avec `ledger.view_cash_accounts`. Le résumé de période (produits/charges
  // agrégés) vient des endpoints "rapports" et reste réservé à `ledger.view_reports`.
  const canReports = can('ledger.view_reports');

  const { data: accounts, isLoading: accountsLoading, isError: accountsError } = useCashAccounts();
  const { data: accountGroups } = useCashAccountGroups();
  const { data: summary } = useLedgerSummary({
    dateFrom: dateFrom ? startOfDayIso(dateFrom) : undefined,
    dateTo:   dateTo   ? endOfDayIso(dateTo)     : undefined,
  }, canReports);

  const activeAccountId = selectedAccountId ?? accounts?.[0]?.id ?? null;
  const { data: entries } = useLedgerEntries(activeAccountId ? {
    accountId: activeAccountId,
    dateFrom:  dateFrom ? startOfDayIso(dateFrom) : undefined,
    dateTo:    dateTo   ? endOfDayIso(dateTo)     : undefined,
    page, limit: 15,
  } : null);

  if (accountsLoading) return <PageLoader />;
  if (accountsError)   return <PageError />;

  const totalBalance = (accounts ?? []).reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="font-display italic text-3xl md:text-4xl text-primary leading-none">{t('treasury.title')}</h2>
          <p className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-[0.2em] mt-2">
            {t('treasury.totalBalance')} — {formatCurrency(totalBalance)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {can('ledger.manage_accounts') && (
            <button
              onClick={() => navigate('/accounts')}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-stone-200 text-on-surface rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-primary/30 transition-all"
            >
              <Settings2 className="w-4 h-4" />
              {t('accounts.title')}
            </button>
          )}
          {can('ledger.contribute') && (
            <button
              onClick={() => setContributionOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-stone-200 text-on-surface rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-primary/30 transition-all"
            >
              <PiggyBank className="w-4 h-4" />
              {t('treasury.contribution')}
            </button>
          )}
          {can('ledger.transfer') && (
            <button
              onClick={() => setTransferOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-black/10"
            >
              <ArrowLeftRight className="w-4 h-4" />
              {t('treasury.transfer')}
            </button>
          )}
        </div>
      </div>

      {/* ── Cash account cards — regroupées par préfixe de code à 3 chiffres (ex: BMOI + BNI
          sous "512 · Banque"), voir getCashAccountGroups côté serveur ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(accountGroups ?? []).map((row, i) => row.isGroup ? (
          <div key={row.id} className="col-span-full flex items-center justify-between px-1 pt-2 first:pt-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">{row.name}</p>
            <p className="font-mono text-xs font-semibold text-on-surface-variant/60">{formatCurrency(row.balance)}</p>
          </div>
        ) : (
          <motion.button
            key={row.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => { setSelectedAccountId(row.id); setPage(1); }}
            className={cn(
              'text-left bg-white p-6 rounded-2xl border transition-all',
              activeAccountId === row.id ? 'border-primary shadow-md shadow-primary/10' : 'border-stone-200/60 hover:border-primary/30',
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-stone-50 text-primary">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1 truncate">{row.name}</p>
            <p className="font-mono text-xl font-bold text-on-surface">{formatCurrency(row.balance)}</p>
          </motion.button>
        ))}
      </div>

      {/* ── Period ── */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('treasury.from')}</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('treasury.to')}</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
        </div>
      </div>

      {/* ── Summary (rapports uniquement) ── */}
      {canReports && summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-stone-200/60">
            <div className="flex items-center gap-2 mb-3 text-on-surface-variant/50">
              <TrendingUp className="w-4 h-4" />
              <p className="text-[10px] font-bold uppercase tracking-widest">{t('treasury.revenueInvoiced')}</p>
            </div>
            <p className="font-mono text-2xl font-bold text-on-surface">{formatCurrency(summary.revenueInvoiced)}</p>
            <p className="text-[10px] text-on-surface-variant/40 mt-2">{t('treasury.revenueCollected')}: {formatCurrency(summary.revenueCollected)}</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-stone-200/60">
            <div className="flex items-center gap-2 mb-3 text-on-surface-variant/50">
              <TrendingDown className="w-4 h-4" />
              <p className="text-[10px] font-bold uppercase tracking-widest">{t('treasury.totalExpenses')}</p>
            </div>
            <p className="font-mono text-2xl font-bold text-on-surface">{formatCurrency(summary.totalExpenses)}</p>
            <div className="mt-2 space-y-0.5">
              {summary.expensesByCategory.map(c => (
                <p key={c.categoryId} className="text-[10px] text-on-surface-variant/40">
                  {c.categoryName}: {formatCurrency(c.total)}
                </p>
              ))}
            </div>
          </div>

          <div className="bg-stone-900 text-white p-6 rounded-3xl">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-3">{t('treasury.netCashFlow')}</p>
            <p className="font-mono text-2xl font-bold">{formatCurrency(summary.netCashFlow)}</p>
          </div>
        </div>
      )}

      {/* ── Statement ── */}
      <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
        <div className="p-6 border-b border-stone-100">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{t('treasury.statement')}</h4>
        </div>
        {!entries || entries.data.length === 0 ? (
          <div className="p-10 text-center text-xs text-on-surface-variant/40">{t('treasury.noEntries')}</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {entries.data.map(l => (
              <div key={l.id} className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                    l.debit > 0 ? 'bg-teal-50 text-teal-600' : 'bg-red-50 text-red-500',
                  )}>
                    {l.debit > 0 ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{l.entry.memo ?? l.entry.source}</p>
                    <p className="text-[10px] text-on-surface-variant/50 mt-0.5">
                      {l.entry.number} · {formatDate(l.entry.date)}
                    </p>
                  </div>
                </div>
                <p className={cn('font-mono text-sm font-bold shrink-0', l.debit > 0 ? 'text-teal-600' : 'text-red-500')}>
                  {l.debit > 0 ? '+' : '−'}{formatCurrency(l.debit > 0 ? l.debit : l.credit)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {entries && entries.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={!entries.meta.hasPrevPage}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 hover:border-primary/30 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-[10px] font-bold text-on-surface-variant/50">
            {t('common.page')} {entries.meta.page} {t('common.of')} {entries.meta.totalPages}
          </span>
          <button
            disabled={!entries.meta.hasNextPage}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 hover:border-primary/30 transition-colors"
          >
            Next →
          </button>
        </div>
      )}

      <CreateTransferModal isOpen={isTransferOpen} onClose={() => setTransferOpen(false)} />
      <CreateContributionModal isOpen={isContributionOpen} onClose={() => setContributionOpen(false)} />
    </div>
  );
};
