import React, { useState } from 'react';
import { Download, Scale, TrendingUp, TrendingDown, AlertTriangle, PiggyBank } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { useBalanceSheet, useIncomeStatement } from '../hooks/useLedger';
import { useOutstandingDeposits } from '../hooks/useInvoices';
import { exportLedgerCsv } from '../api/ledger';
import { PageLoader, PageError } from '../components/QueryLoader';
import { formatCurrency, formatDate, dateToLocalStr, todayLocalStr, startOfDayIso, endOfDayIso } from '../lib/format';

const firstOfMonth = () => {
  const now = new Date();
  return dateToLocalStr(new Date(now.getFullYear(), now.getMonth(), 1));
};

const inside = '↳ ';

// Les comptes partageant un préfixe de code sont regroupés sous un en-tête virtuel calculé
// côté serveur (ex: 512100 BMOI + 512200 BNI → groupe "512 · Banque") — `isGroup` distingue ces cumuls d'affichage
// des vrais comptes, `depth` gère l'indentation en cascade.
const RowList: React.FC<{ rows: { code: string; name: string; balance?: number; total?: number; depth: number; isGroup: boolean }[] }> = ({ rows }) => (
  <div className="space-y-2">
    {rows.map(r => {
      const amount = r.balance ?? r.total ?? 0;
      return (
        <div key={r.code} className={cn('flex items-center justify-between gap-3 text-sm', amount === 0 && 'opacity-40')} style={{ paddingLeft: r.depth * 16 }}>
          <span className={cn('truncate', r.isGroup ? 'text-on-surface font-semibold' : 'text-on-surface-variant')}>
            {!r.isGroup && r.depth > 0 && inside}{r.name}
          </span>
          <span className={cn('font-mono shrink-0', r.isGroup ? 'font-bold text-on-surface' : 'text-on-surface-variant')}>
            {formatCurrency(amount)}
          </span>
        </div>
      );
    })}
  </div>
);

export const Reports: React.FC = () => {
  const { t } = useTranslation();

  const [asOf, setAsOf] = useState(todayLocalStr());
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo,   setDateTo]   = useState(todayLocalStr());
  const [isExporting, setExporting] = useState(false);
  const [showZeroBalances, setShowZeroBalances] = useState(false);

  const { data: balanceSheet, isLoading: bsLoading, isError: bsError } = useBalanceSheet(
    asOf ? endOfDayIso(asOf) : undefined,
    showZeroBalances,
  );
  const { data: incomeStatement } = useIncomeStatement({
    dateFrom: dateFrom ? startOfDayIso(dateFrom) : undefined,
    dateTo:   dateTo   ? endOfDayIso(dateTo)     : undefined,
  });
  const { data: outstandingDeposits } = useOutstandingDeposits();
  const outstandingDepositsTotal = (outstandingDeposits ?? []).reduce((s, d) => s + d.totalAmount, 0);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportLedgerCsv({
        dateFrom: dateFrom ? startOfDayIso(dateFrom) : undefined,
        dateTo:   dateTo   ? endOfDayIso(dateTo)     : undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grand-livre-${todayLocalStr()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (bsLoading) return <PageLoader />;
  if (bsError)   return <PageError />;

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="font-display italic text-3xl md:text-4xl text-primary leading-none">{t('reports.title')}</h2>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-black/10 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isExporting ? t('common.saving') : t('reports.exportCsv')}
        </button>
      </div>

      {/* ── Balance sheet ── */}
      <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-on-surface-variant/50" />
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{t('reports.balanceSheet')}</h4>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={showZeroBalances} onChange={e => setShowZeroBalances(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-stone-300 text-primary focus:ring-primary/30 cursor-pointer" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">{t('reports.showZeroBalances')}</span>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">{t('reports.asOf')}</label>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
              className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
          </div>
        </div>

        {balanceSheet && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-4">{t('reports.assets')}</p>
              {balanceSheet.assets.length === 0
                ? <p className="text-xs text-on-surface-variant/40">{t('reports.noData')}</p>
                : <RowList rows={balanceSheet.assets} />}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-stone-100">
                <span className="text-xs font-bold text-on-surface">{t('reports.total')}</span>
                <span className="font-mono font-bold text-on-surface">{formatCurrency(balanceSheet.totalAssets)}</span>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-4">{t('reports.liabilitiesAndEquity')}</p>
              {balanceSheet.liabilities.length === 0 && balanceSheet.equity.length === 0
                ? <p className="text-xs text-on-surface-variant/40">{t('reports.noData')}</p>
                : <RowList rows={[...balanceSheet.liabilities, ...balanceSheet.equity]} />}
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-on-surface-variant">{t('reports.netIncomeToDate')}</span>
                <span className="font-mono font-semibold text-on-surface">{formatCurrency(balanceSheet.netIncomeToDate)}</span>
              </div>
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-stone-100">
                <span className="text-xs font-bold text-on-surface">{t('reports.total')}</span>
                <span className="font-mono font-bold text-on-surface">{formatCurrency(balanceSheet.totalLiabilitiesAndEquity)}</span>
              </div>
            </div>
          </div>
        )}

        {balanceSheet && !balanceSheet.balanced && (
          <div className="mx-6 mb-6 flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-xs font-medium">{t('reports.unbalanced')}</p>
          </div>
        )}
      </div>

      {/* ── Acomptes en cours — trace le solde du compte 419100 du bilan, réservation par
          réservation ; disparaît une fois la facture définitive de la réservation visée. ── */}
      <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-on-surface-variant/50" />
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{t('reports.outstandingDeposits')}</h4>
          </div>
          {outstandingDeposits && outstandingDeposits.length > 0 && (
            <span className="font-mono text-sm font-bold text-on-surface">{formatCurrency(outstandingDepositsTotal)}</span>
          )}
        </div>
        {!outstandingDeposits || outstandingDeposits.length === 0 ? (
          <div className="p-10 text-center text-xs text-on-surface-variant/40">{t('reports.noOutstandingDeposits')}</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {outstandingDeposits.map(d => (
              <Link
                key={d.id}
                to={`/invoices/document/${d.id}`}
                className="p-4 flex items-center justify-between gap-3 hover:bg-stone-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{d.guest.name}</p>
                  <p className="text-[10px] text-on-surface-variant/50 font-mono">{d.number} · {formatDate(d.validatedAt)}</p>
                </div>
                <span className="font-mono text-sm font-bold text-on-surface shrink-0">{formatCurrency(d.totalAmount)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Income statement ── */}
      <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{t('reports.incomeStatement')}</h4>
          <div className="flex items-end gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1">{t('treasury.from')}</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1">{t('treasury.to')}</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
            </div>
          </div>
        </div>

        {incomeStatement && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-teal-600" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">{t('reports.revenue')}</p>
              </div>
              {incomeStatement.revenue.length === 0
                ? <p className="text-xs text-on-surface-variant/40">{t('reports.noData')}</p>
                : <RowList rows={incomeStatement.revenue} />}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-stone-100">
                <span className="text-xs font-bold text-on-surface">{t('reports.total')}</span>
                <span className="font-mono font-bold text-on-surface">{formatCurrency(incomeStatement.totalRevenue)}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">{t('reports.expenses')}</p>
              </div>
              {incomeStatement.expenses.length === 0
                ? <p className="text-xs text-on-surface-variant/40">{t('reports.noData')}</p>
                : <RowList rows={incomeStatement.expenses} />}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-stone-100">
                <span className="text-xs font-bold text-on-surface">{t('reports.total')}</span>
                <span className="font-mono font-bold text-on-surface">{formatCurrency(incomeStatement.totalExpenses)}</span>
              </div>
            </div>
          </div>
        )}

        {incomeStatement && (
          <div className={cn(
            'mx-6 mb-6 p-5 rounded-2xl flex items-center justify-between',
            incomeStatement.netIncome >= 0 ? 'bg-teal-50' : 'bg-red-50',
          )}>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">{t('reports.netIncome')}</span>
            <span className={cn('font-mono text-xl font-bold', incomeStatement.netIncome >= 0 ? 'text-teal-700' : 'text-red-600')}>
              {formatCurrency(incomeStatement.netIncome)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
