import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, AlertTriangle, Search, Printer, ClipboardCheck, Ban, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage } from '../lib/apiError';
import { formatCurrency, formatDateTime } from '../lib/format';
import { InventoryCountLine } from '../api/inventory';
import { useInventoryCount, useRecordCountLines, useValidateInventoryCount, useCancelInventoryCount } from '../hooks/useInventory';
import { PageLoader, PageError } from '../components/QueryLoader';
import { ConfirmModal } from '../components/ConfirmModal';

const STATUS_CLASS = {
  in_progress: 'bg-amber-100 text-amber-800',
  validated:   'bg-emerald-100 text-emerald-800',
  cancelled:   'bg-stone-100 text-on-surface-variant/60',
} as const;

// Lignes regroupées par catégorie, puis les variantes d'un même article sous un intitulé commun.
interface Block { key: string; parentName: string | null; lines: InventoryCountLine[] }
interface Section { category: string; blocks: Block[] }

function groupLines(lines: InventoryCountLine[]): Section[] {
  const sections: Section[] = [];
  for (const line of lines) {
    let section = sections.find(s => s.category === line.category.name);
    if (!section) { section = { category: line.category.name, blocks: [] }; sections.push(section); }
    const key = line.parentId ?? line.itemId;
    let block = section.blocks.find(b => b.key === key);
    if (!block) { block = { key, parentName: line.parentName, lines: [] }; section.blocks.push(block); }
    block.lines.push(line);
  }
  return sections;
}

const parseQty = (value: string): number | null => {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

export const InventoryCount: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { can } = useAuth();
  const canValidate = can('inventory.validate_count');
  const canSeeValue = can('inventory.view_value');

  const { data: count, isLoading, isError } = useInventoryCount(id);
  const recordLines = useRecordCountLines();
  const validate = useValidateInventoryCount();
  const cancel = useCancelInventoryCount();

  const [drafts, setDrafts]           = useState<Record<string, string>>({});
  const [search, setSearch]           = useState('');
  const [onlyUncounted, setUncounted] = useState(false);
  const [onlyGaps, setOnlyGaps]       = useState(false);
  const [confirm, setConfirm]         = useState<'validate' | 'cancel' | null>(null);
  const [apiError, setApiError]       = useState('');

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (count?.lines ?? []).filter(l =>
      (!needle || l.name.toLowerCase().includes(needle) || l.category.name.toLowerCase().includes(needle))
      && (!onlyUncounted || l.countedQty == null)
      && (!onlyGaps || (l.gap != null && l.gap !== 0)));
  }, [count, search, onlyUncounted, onlyGaps]);
  const sections = useMemo(() => groupLines(visible), [visible]);

  if (isLoading) return <PageLoader />;
  if (isError || !count) return <PageError />;

  const inProgress = count.status === 'in_progress';
  const none = t('inventory.stockCount.none');
  const progress = count.totalLines ? Math.round((count.countedLines / count.totalLines) * 100) : 0;
  const onError = (err: unknown) => setApiError(getApiErrorMessage(err, t('common.error')));

  const save = (line: InventoryCountLine, countedQty: number | null) => {
    setApiError('');
    recordLines.mutate(
      { id: count.id, lines: [{ itemId: line.itemId, countedQty }] },
      { onSuccess: () => setDrafts(d => { const next = { ...d }; delete next[line.itemId]; return next; }), onError },
    );
  };

  const commitDraft = (line: InventoryCountLine) => {
    const draft = drafts[line.itemId];
    if (draft === undefined) return;
    const qty = parseQty(draft);
    if (draft.trim() !== '' && qty === null) return;
    if (qty === line.countedQty) { setDrafts(d => { const next = { ...d }; delete next[line.itemId]; return next; }); return; }
    save(line, qty);
  };

  const runConfirm = () => {
    const mutation = confirm === 'validate' ? validate : cancel;
    setApiError('');
    mutation.mutate(count.id, { onSuccess: () => setConfirm(null), onError: (err) => { setConfirm(null); onError(err); } });
  };

  const gapCell = (line: InventoryCountLine) => {
    if (line.ignored) return <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">{t('inventory.stockCount.ignored')}</span>;
    if (line.gap == null) return <span className="text-on-surface-variant/30">{none}</span>;
    return (
      <span className={cn('font-bold tabular-nums', line.gap === 0 ? 'text-emerald-700' : line.gap > 0 ? 'text-sky-700' : 'text-red-600')}>
        {line.gap > 0 ? t('inventory.stockCount.plus', { value: line.gap }) : line.gap}
      </span>
    );
  };

  return (
    <div className="space-y-8 pb-12">
      <Link to="/inventory?tab=counts" className="no-print inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 hover:text-primary">
        <ArrowLeft className="w-4 h-4" /> {t('inventory.stockCount.back')}
      </Link>

      {/* ── En-tête ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-display italic text-3xl md:text-4xl text-primary leading-none">{t('inventory.stockCount.title', { number: count.number })}</h2>
            <span className={cn('px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest', STATUS_CLASS[count.status])}>
              {t(`inventory.stockCount.status.${count.status}`)}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant/60">
            {t('inventory.stockCount.openedBy', { date: formatDateTime(count.createdAt), name: count.createdBy?.name ?? none })}
            {count.validatedAt && <> · {t('inventory.stockCount.validatedBy', { date: formatDateTime(count.validatedAt), name: count.validatedBy?.name ?? none })}</>}
            {count.cancelledAt && <> · {t('inventory.stockCount.cancelledAt', { date: formatDateTime(count.cancelledAt) })}</>}
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-3">
          {!inProgress && (
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-primary/30 transition-all">
              <Printer className="w-4 h-4" /> {t('common.print')}
            </button>
          )}
          {inProgress && canValidate && (
            <>
              <button onClick={() => setConfirm('cancel')}
                className="flex items-center gap-2 px-5 py-3 bg-white border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-red-200 hover:text-red-600 transition-all">
                <Ban className="w-4 h-4" /> {t('inventory.stockCount.cancel')}
              </button>
              <button onClick={() => setConfirm('validate')} disabled={count.countedLines === 0}
                className="flex items-center gap-2 px-5 py-3 bg-zinc-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-black/10 disabled:opacity-50">
                <ClipboardCheck className="w-4 h-4" /> {t('inventory.stockCount.validate')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Avancement / synthèse ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-stone-200 p-4 col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">{t('inventory.stockCount.progress')}</p>
          <p className="text-lg font-bold tabular-nums mt-1">{t('inventory.stockCount.progressValue', { counted: count.countedLines, total: count.totalLines })}</p>
          <div className="h-1.5 bg-stone-100 rounded-full mt-2 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t('inventory.stockCount.progress')}>
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">{t('inventory.stockCount.gapLines')}</p>
          <p className="text-lg font-bold tabular-nums mt-1">{count.gapLines}</p>
        </div>
        {canSeeValue && count.gapValue != null && (
          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">{t('inventory.stockCount.gapValue')}</p>
            <p className={cn('text-lg font-bold tabular-nums mt-1', count.gapValue < 0 && 'text-red-600')}>{formatCurrency(count.gapValue)}</p>
          </div>
        )}
      </div>

      {inProgress && <p className="no-print text-xs text-on-surface-variant/70">{t('inventory.stockCount.help')}</p>}

      {apiError && (
        <div role="alert" className="no-print flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-xs font-medium">{apiError}</p>
        </div>
      )}

      {/* ── Filtres ── */}
      <div className="no-print flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} aria-label={t('common.search')}
            placeholder={t('inventory.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
        </div>
        {inProgress && (
          <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer">
            <input type="checkbox" checked={onlyUncounted} onChange={e => setUncounted(e.target.checked)} className="accent-primary" />
            {t('inventory.stockCount.onlyUncounted')}
          </label>
        )}
        <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer">
          <input type="checkbox" checked={onlyGaps} onChange={e => setOnlyGaps(e.target.checked)} className="accent-primary" />
          {t('inventory.stockCount.onlyGaps')}
        </label>
      </div>

      {/* ── Lignes ── */}
      {sections.length === 0 ? (
        <p className="text-sm text-on-surface-variant/60 text-center py-12">{t('inventory.emptyFiltered')}</p>
      ) : (
        <div className="space-y-6">
          {sections.map(section => (
            <section key={section.category} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <h3 className="px-5 py-3 bg-stone-50 border-b border-stone-200 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">{section.category}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-on-surface-variant/50 text-left">
                      <th className="px-5 py-2 font-bold">{t('inventory.stockCount.columns.item')}</th>
                      <th className="px-3 py-2 font-bold text-right">{inProgress ? t('inventory.stockCount.columns.theoretical') : t('inventory.stockCount.columns.atValidation')}</th>
                      <th className="px-3 py-2 font-bold text-right">{t('inventory.stockCount.columns.counted')}</th>
                      <th className="px-3 py-2 font-bold text-right">{t('inventory.stockCount.columns.gap')}</th>
                      {canSeeValue && !inProgress && <th className="px-5 py-2 font-bold text-right">{t('inventory.stockCount.columns.value')}</th>}
                    </tr>
                  </thead>
                  {section.blocks.map(block => (
                    <tbody key={block.key} className="border-t border-stone-100">
                      {block.parentName && (
                        <tr className="bg-stone-50/60">
                          <td className="px-5 py-2 font-bold text-on-surface">{block.parentName}</td>
                          <td className="px-3 py-2 text-right text-xs text-on-surface-variant/60 tabular-nums">
                            {block.lines.reduce((sum, l) => sum + (l.currentQty ?? 0), 0)}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-on-surface-variant/60 tabular-nums">
                            {block.lines.every(l => l.countedQty != null) ? block.lines.reduce((sum, l) => sum + (l.countedQty ?? 0), 0) : none}
                          </td>
                          <td colSpan={canSeeValue && !inProgress ? 2 : 1} />
                        </tr>
                      )}
                      {block.lines.map(line => {
                        const draft = drafts[line.itemId];
                        const label = line.variantName ?? line.name;
                        return (
                          <tr key={line.id} className="border-t border-stone-100 align-middle">
                            <td className={cn('px-5 py-2.5', block.parentName && 'pl-10')}>
                              <div className="flex items-center gap-2">
                                <span className="text-on-surface">{label}</span>
                                {line.movedSinceCount && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700" title={t('inventory.stockCount.movedSinceCount')}>
                                    <AlertTriangle className="w-3.5 h-3.5" /> {t('inventory.stockCount.recount')}
                                  </span>
                                )}
                              </div>
                              {line.countedBy && <p className="text-[10px] text-on-surface-variant/50">{t('inventory.stockCount.countedBy', { name: line.countedBy.name })}</p>}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-on-surface-variant">
                              {line.currentQty ?? none} <span className="text-[10px] text-on-surface-variant/50">{line.unit}</span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {inProgress ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <input
                                    type="number" min={0} inputMode="numeric"
                                    value={draft ?? (line.countedQty != null ? String(line.countedQty) : '')}
                                    onChange={e => setDrafts(d => ({ ...d, [line.itemId]: e.target.value }))}
                                    onBlur={() => commitDraft(line)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitDraft(line); } }}
                                    aria-label={t('inventory.stockCount.countedFor', { name: line.name })}
                                    className={cn('w-20 px-2 py-1.5 text-right bg-stone-50 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none tabular-nums',
                                      line.countedQty != null ? 'border-primary/40' : 'border-stone-200')}
                                  />
                                  <button type="button" onClick={() => line.currentQty != null && save(line, line.currentQty)}
                                    disabled={recordLines.isPending || line.currentQty == null}
                                    aria-label={t('inventory.stockCount.asExpectedFor', { name: line.name })} title={t('inventory.stockCount.asExpected')}
                                    className={cn('p-1.5 rounded-lg border transition-colors disabled:opacity-40',
                                      line.countedQty != null && line.countedQty === line.currentQty
                                        ? 'bg-emerald-600 border-emerald-600 text-white'
                                        : 'border-stone-200 text-on-surface-variant/60 hover:border-emerald-400 hover:text-emerald-700')}>
                                    <Check className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="tabular-nums">{line.countedQty ?? none}</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right">{gapCell(line)}</td>
                            {canSeeValue && !inProgress && (
                              <td className={cn('px-5 py-2.5 text-right tabular-nums', (line.gapValue ?? 0) < 0 && 'text-red-600')}>
                                {line.gapValue ? formatCurrency(line.gapValue) : none}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  ))}
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        isPending={validate.isPending || cancel.isPending}
        variant={confirm === 'cancel' ? 'danger' : 'warning'}
        title={confirm === 'cancel' ? t('inventory.stockCount.cancelTitle') : t('inventory.stockCount.validateTitle')}
        message={confirm === 'cancel'
          ? t('inventory.stockCount.cancelMessage')
          : t('inventory.stockCount.validateMessage', { counted: count.countedLines, total: count.totalLines, gaps: count.gapLines })}
        confirmLabel={confirm === 'cancel' ? t('inventory.stockCount.cancel') : t('inventory.stockCount.validate')}
        cancelLabel={confirm === 'cancel' ? undefined : t('common.cancel')}
      />
    </div>
  );
};
