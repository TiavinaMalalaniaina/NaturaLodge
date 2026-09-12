import React, { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useSetOccupancyTarget } from '../../hooks/useKpi';
import { getApiErrorMessage } from '../../lib/apiError';
import { pct } from './KpiWidgets';

// Objectif d'occupation saisi manuellement pour le mois affiché (ex: prévision haute saison),
// comparé au taux réel — juste sous le héros occupation, car c'est le contexte qui qualifie ce
// chiffre en premier.
export const OccupancyTargetCard: React.FC<{ month: string; targetRate: number | null; gap: number | null }> = ({ month, targetRate, gap }) => {
  const { t } = useTranslation();
  const { can } = useAuth();
  const canEdit = can('kpi.manage_target');
  const setTarget = useSetOccupancyTarget();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setDraft(targetRate == null ? '' : (targetRate * 100).toString());
    setError(null);
    setEditing(true);
  };

  const save = () => {
    const value = Number(draft);
    if (!draft || Number.isNaN(value) || value < 0 || value > 150) {
      setError(t('kpi.invalidTarget'));
      return;
    }
    setTarget.mutate({ month, targetRate: value / 100 }, {
      onSuccess: () => setEditing(false),
      onError:   (err) => setError(getApiErrorMessage(err)),
    });
  };

  if (editing) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">{t('kpi.occupancyTarget')}</p>
        <div className="flex items-center gap-2">
          <input
            type="number" min={0} max={150} step={1} autoFocus value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            className="w-24 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
          <span className="text-sm text-on-surface-variant/60">%</span>
          <button onClick={save} disabled={setTarget.isPending}
            className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-40">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => setEditing(false)} disabled={setTarget.isPending}
            className="p-1.5 rounded-lg text-on-surface-variant/50 hover:bg-stone-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">{t('kpi.occupancyTarget')}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-mono text-lg font-bold text-on-surface">{targetRate == null ? t('common.notSet') : pct(targetRate)}</span>
          {gap != null && (
            <span className={cn('text-xs font-mono font-semibold', gap >= 0 ? 'text-teal-700' : 'text-red-600')}>
              {gap >= 0 ? '+' : ''}{pct(gap)}
            </span>
          )}
        </div>
      </div>
      {canEdit && (
        <button onClick={startEdit} className="p-2 rounded-lg text-on-surface-variant/40 hover:bg-stone-100 hover:text-primary transition-colors">
          <Pencil className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
