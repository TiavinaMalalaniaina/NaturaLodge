import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardCheck, ChevronRight, AlertCircle, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { getApiErrorMessage } from '../../lib/apiError';
import { formatDateTime } from '../../lib/format';
import { useInventoryCounts, useOpenInventoryCount } from '../../hooks/useInventory';
import { PageLoader, PageError } from '../QueryLoader';
import { ConfirmModal } from '../ConfirmModal';

const STATUS_CLASS = {
  in_progress: 'bg-amber-100 text-amber-800',
  validated:   'bg-emerald-100 text-emerald-800',
  cancelled:   'bg-stone-100 text-on-surface-variant/60',
} as const;

export const InventoryCountsTab: React.FC = () => {
  const { t } = useTranslation();
  const { can } = useAuth();
  const navigate = useNavigate();
  const { data: counts = [], isLoading, isError } = useInventoryCounts();
  const openCount = useOpenInventoryCount();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [apiError, setApiError] = useState('');

  if (isLoading) return <PageLoader />;
  if (isError) return <PageError />;

  const current = counts.find(c => c.status === 'in_progress');

  const handleOpen = () => {
    setApiError('');
    openCount.mutate(undefined, {
      onSuccess: (count) => { setConfirmOpen(false); navigate(`/inventory/counts/${count.id}`); },
      onError: (err) => { setConfirmOpen(false); setApiError(getApiErrorMessage(err, t('common.error'))); },
    });
  };

  return (
    <div className="space-y-6">
      {apiError && (
        <div role="alert" className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-xs font-medium">{apiError}</p>
        </div>
      )}

      {current ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-amber-50 border border-amber-200 rounded-2xl">
          <div>
            <p className="text-sm font-bold text-amber-900">{t('inventory.counts.currentTitle', { number: current.number })}</p>
            <p className="text-xs text-amber-800/80 mt-0.5">{t('inventory.stockCount.progressValue', { counted: current.countedLines, total: current.totalLines })}</p>
          </div>
          <Link to={`/inventory/counts/${current.id}`}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all">
            <ClipboardCheck className="w-4 h-4" /> {t('inventory.counts.continue')}
          </Link>
        </div>
      ) : can('inventory.validate_count') && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border border-stone-200 rounded-2xl">
          <p className="text-sm text-on-surface-variant">{t('inventory.counts.openHint')}</p>
          <button onClick={() => setConfirmOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all">
            <Plus className="w-4 h-4" /> {t('inventory.counts.open')}
          </button>
        </div>
      )}

      {counts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-16 text-center">
          <ClipboardCheck className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-4 stroke-1" />
          <p className="text-sm font-medium text-on-surface-variant/50">{t('inventory.counts.empty')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {counts.map(c => (
            <li key={c.id}>
              <Link to={`/inventory/counts/${c.id}`}
                className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center justify-between gap-4 hover:border-primary/30 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-on-surface">{c.number}</p>
                    <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest', STATUS_CLASS[c.status])}>
                      {t(`inventory.stockCount.status.${c.status}`)}
                    </span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant/50 mt-0.5">
                    {t('inventory.stockCount.openedBy', { date: formatDateTime(c.createdAt), name: c.createdBy?.name ?? t('inventory.stockCount.none') })}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-bold tabular-nums">{t('inventory.stockCount.progressValue', { counted: c.countedLines, total: c.totalLines })}</p>
                    {c.status === 'validated' && <p className="text-[10px] text-on-surface-variant/50">{t('inventory.counts.gapSummary', { count: c.gapLines })}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-on-surface-variant/40" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleOpen}
        isPending={openCount.isPending}
        variant="warning"
        title={t('inventory.counts.open')}
        message={t('inventory.counts.openMessage')}
        confirmLabel={t('inventory.counts.open')}
        cancelLabel={t('common.cancel')}
      />
    </div>
  );
};
