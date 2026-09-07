import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Wallet, ArrowUpRight, ArrowDownLeft, Receipt, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { useTreasuryAccess, useSaveRoleTreasuryAccess } from '../hooks/useLedger';
import { PageLoader, PageError } from '../components/QueryLoader';
import { getApiErrorMessage } from '../lib/apiError';

type Row = { visible: boolean; from: boolean; to: boolean; pay: boolean };
type Draft = Record<string, Row>;

const EMPTY_ROW: Row = { visible: false, from: false, to: false, pay: false };

export const TreasuryAccess: React.FC = () => {
  const { t } = useTranslation();
  const { data: config, isLoading, isError } = useTreasuryAccess();
  const save = useSaveRoleTreasuryAccess();

  const [roleId, setRoleId]   = useState<string | null>(null);
  const [draft, setDraft]     = useState<Draft>({});
  const [baseline, setBaseline] = useState<Draft>({});
  const [apiError, setApiError] = useState('');

  const activeRoleId = roleId ?? config?.roles[0]?.id ?? null;

  const draftForRole = useMemo<Draft>(() => {
    if (!config || !activeRoleId) return {};
    const next: Draft = {};
    for (const acc of config.cashAccounts) {
      const g = config.grants.find(x => x.roleId === activeRoleId && x.accountId === acc.id);
      next[acc.id] = g
        ? { visible: true, from: g.canTransferFrom, to: g.canTransferTo, pay: g.canPayExpenses }
        : { ...EMPTY_ROW };
    }
    return next;
  }, [config, activeRoleId]);

  // Réinitialise l'état local quand la config ou le rôle sélectionné change.
  const draftKey = `${activeRoleId}:${config?.grants.length ?? 0}`;
  const [syncedKey, setSyncedKey] = useState('');
  if (draftKey !== syncedKey && config && activeRoleId) {
    setDraft(draftForRole);
    setBaseline(draftForRole);
    setSyncedKey(draftKey);
    setApiError('');
  }

  if (isLoading) return <PageLoader />;
  if (isError || !config) return <PageError />;

  const roles        = config.roles;
  const cashAccounts = config.cashAccounts;
  const accessAll    = activeRoleId ? config.accessAllRoleIds.includes(activeRoleId) : false;

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const visibleCount = Object.values(draft).filter(r => r.visible).length;

  const setRow = (accountId: string, patch: Partial<Row>) => {
    setDraft(prev => {
      const row = { ...(prev[accountId] ?? EMPTY_ROW), ...patch };
      if (!row.visible) { row.from = false; row.to = false; row.pay = false; }
      return { ...prev, [accountId]: row };
    });
  };

  const handleSave = () => {
    if (!activeRoleId) return;
    setApiError('');
    const grants = Object.entries(draft)
      .filter(([, r]) => r.visible)
      .map(([accountId, r]) => ({ accountId, canTransferFrom: r.from, canTransferTo: r.to, canPayExpenses: r.pay }));
    save.mutate({ roleId: activeRoleId, grants }, {
      onSuccess: () => setBaseline(draft),
      onError: (err) => setApiError(getApiErrorMessage(err, t('common.error'))),
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

      <div>
        <h2 className="font-display italic text-3xl md:text-4xl text-primary leading-none">{t('treasuryAccess.title')}</h2>
        <p className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-[0.2em] mt-2">{t('treasuryAccess.hint')}</p>
      </div>

      {/* Rôles */}
      <div className="flex gap-2 flex-wrap">
        {roles.map(r => (
          <button
            key={r.id}
            onClick={() => setRoleId(r.id)}
            className={cn(
              'px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all',
              r.id === activeRoleId
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-white text-on-surface-variant border-stone-200 hover:border-primary/30',
            )}
          >
            {r.name}
          </button>
        ))}
      </div>

      {apiError && (
        <div className="flex items-center gap-2 text-red-500 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{apiError}
        </div>
      )}

      {accessAll && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs">{t('treasuryAccess.accessAllWarning')}</p>
        </div>
      )}

      {!accessAll && visibleCount === 0 && (
        <div className="flex items-start gap-3 p-4 bg-stone-50 border border-stone-200 rounded-2xl text-on-surface-variant">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs">{t('treasuryAccess.seesAll')}</p>
        </div>
      )}

      {/* Grille comptes */}
      <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead>
              <tr className="bg-stone-50/50 border-b border-stone-100">
                <th className="px-6 py-3 text-[9px] font-bold tracking-widest uppercase text-on-surface-variant/40">{t('treasuryAccess.account')}</th>
                <th className="px-4 py-3 text-[9px] font-bold tracking-widest uppercase text-on-surface-variant/40 text-center">{t('treasuryAccess.visible')}</th>
                <th className="px-4 py-3 text-[9px] font-bold tracking-widest uppercase text-on-surface-variant/40 text-center">
                  <span className="inline-flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />{t('treasuryAccess.source')}</span>
                </th>
                <th className="px-4 py-3 text-[9px] font-bold tracking-widest uppercase text-on-surface-variant/40 text-center">
                  <span className="inline-flex items-center gap-1"><ArrowDownLeft className="w-3 h-3" />{t('treasuryAccess.destination')}</span>
                </th>
                <th className="px-4 py-3 text-[9px] font-bold tracking-widest uppercase text-on-surface-variant/40 text-center">
                  <span className="inline-flex items-center gap-1"><Receipt className="w-3 h-3" />{t('treasuryAccess.expense')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {cashAccounts.map(acc => {
                const row = draft[acc.id] ?? EMPTY_ROW;
                return (
                  <tr key={acc.id} className={cn(accessAll && 'opacity-50')}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-3.5 h-3.5 text-on-surface-variant/30 shrink-0" />
                        <span className="text-xs font-semibold text-on-surface font-mono">{acc.code}</span>
                        <span className="text-xs text-on-surface truncate">{acc.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={row.visible}
                        disabled={accessAll || save.isPending}
                        onChange={e => setRow(acc.id, { visible: e.target.checked })}
                        className="w-4 h-4 rounded border-stone-300 text-primary focus:ring-primary/30 cursor-pointer disabled:opacity-40"
                      />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={row.from}
                        disabled={accessAll || !row.visible || save.isPending}
                        onChange={e => setRow(acc.id, { from: e.target.checked })}
                        className="w-4 h-4 rounded border-stone-300 text-primary focus:ring-primary/30 cursor-pointer disabled:opacity-30"
                      />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={row.to}
                        disabled={accessAll || !row.visible || save.isPending}
                        onChange={e => setRow(acc.id, { to: e.target.checked })}
                        className="w-4 h-4 rounded border-stone-300 text-primary focus:ring-primary/30 cursor-pointer disabled:opacity-30"
                      />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={row.pay}
                        disabled={accessAll || !row.visible || save.isPending}
                        onChange={e => setRow(acc.id, { pay: e.target.checked })}
                        className="w-4 h-4 rounded border-stone-300 text-primary focus:ring-primary/30 cursor-pointer disabled:opacity-30"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-on-surface-variant/50 leading-relaxed max-w-2xl">{t('treasuryAccess.footnote')}</p>

      <div className="flex justify-end gap-3">
        <button
          onClick={() => setDraft(baseline)}
          disabled={!dirty || save.isPending}
          className="px-4 py-2.5 border border-stone-200 rounded-xl text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:bg-stone-50 transition-colors disabled:opacity-40"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={!dirty || save.isPending}
          className="px-5 py-2.5 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {save.isPending ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </motion.div>
  );
};
