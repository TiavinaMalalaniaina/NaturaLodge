import React, { useState } from 'react';
import { ShieldAlert, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { useAuditLogs, useAuditLogResourceTypes } from '../hooks/useAuditLogs';
import { PageLoader, PageError } from '../components/QueryLoader';
import { formatDate, dateToLocalStr, todayLocalStr, startOfDayIso, endOfDayIso } from '../lib/format';
import { AuditLogEntry } from '../api/auditLogs';

const METHOD_CLASS: Record<string, string> = {
  POST:   'bg-teal-50 text-teal-700 border-teal-200',
  PATCH:  'bg-amber-50 text-amber-700 border-amber-200',
  PUT:    'bg-amber-50 text-amber-700 border-amber-200',
  DELETE: 'bg-red-50 text-red-600 border-red-200',
};

const firstOfMonth = () => {
  const now = new Date();
  return dateToLocalStr(new Date(now.getFullYear(), now.getMonth(), 1));
};

const AuditLogRow: React.FC<{ entry: AuditLogEntry }> = ({ entry }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasBody = entry.body && Object.keys(entry.body).length > 0;

  return (
    <div className="border-b border-stone-100 last:border-0">
      <button
        onClick={() => hasBody && setIsExpanded(prev => !prev)}
        className={cn('w-full p-5 flex items-center justify-between gap-4 text-left', hasBody && 'cursor-pointer hover:bg-stone-50/50')}
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border shrink-0', METHOD_CLASS[entry.method] ?? 'bg-stone-100 text-stone-500 border-stone-200')}>
            {entry.method}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-on-surface font-mono truncate">{entry.path}</p>
            <p className="text-[10px] text-on-surface-variant/50 mt-0.5">
              {entry.user ? `${entry.user.name} · ${entry.user.role}` : '—'} · {formatDate(entry.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={cn(
            'px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border',
            entry.statusCode < 300 ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-red-50 text-red-600 border-red-200',
          )}>
            {entry.statusCode}
          </span>
          {hasBody && <ChevronDown className={cn('w-3.5 h-3.5 text-on-surface-variant/40 transition-transform', isExpanded ? 'rotate-180' : '')} />}
        </div>
      </button>
      {isExpanded && hasBody && (
        <pre className="mx-5 mb-5 p-4 bg-stone-50 rounded-xl text-[11px] font-mono text-on-surface-variant overflow-x-auto">
          {JSON.stringify(entry.body, null, 2)}
        </pre>
      )}
    </div>
  );
};

export const AuditLog: React.FC = () => {
  const { t } = useTranslation();

  const [resourceType, setResourceType] = useState('all');
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo,   setDateTo]   = useState(todayLocalStr());
  const [page, setPage] = useState(1);

  const { data: resourceTypes } = useAuditLogResourceTypes();
  const { data, isLoading, isError } = useAuditLogs({
    resourceType: resourceType !== 'all' ? resourceType : undefined,
    dateFrom: dateFrom ? startOfDayIso(dateFrom) : undefined,
    dateTo:   dateTo   ? endOfDayIso(dateTo)     : undefined,
    page, limit: 30,
  });

  const entries = data?.data ?? [];
  const meta = data?.meta;

  if (isLoading) return <PageLoader />;
  if (isError)   return <PageError />;

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div>
        <h2 className="font-display italic text-3xl md:text-4xl text-primary leading-none">{t('auditLog.title')}</h2>
        <p className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-[0.2em] mt-2">
          {t('auditLog.count', { count: meta?.total ?? entries.length })}
        </p>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('auditLog.resourceType')}</label>
          <select value={resourceType} onChange={e => { setResourceType(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
            <option value="all">{t('common.all')}</option>
            {(resourceTypes ?? []).map(rt => <option key={rt} value={rt}>{rt}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('treasury.from')}</label>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1.5">{t('treasury.to')}</label>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
        </div>
      </div>

      {/* ── List ── */}
      <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
        {entries.length === 0 ? (
          <div className="p-16 text-center">
            <ShieldAlert className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-4 stroke-1" />
            <p className="text-sm font-medium text-on-surface-variant/50">{t('auditLog.empty')}</p>
          </div>
        ) : (
          entries.map(entry => <AuditLogRow key={entry.id} entry={entry} />)
        )}
      </div>

      {/* ── Pagination ── */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={!meta.hasPrevPage}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 hover:border-primary/30 transition-colors"
          >
            {t('common.prev')}
          </button>
          <span className="text-[10px] font-bold text-on-surface-variant/50">
            {t('common.page')} {meta.page} {t('common.of')} {meta.totalPages}
          </span>
          <button
            disabled={!meta.hasNextPage}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 hover:border-primary/30 transition-colors"
          >
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  );
};
