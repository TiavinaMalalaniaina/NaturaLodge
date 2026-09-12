import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

// Formatage partagé par les 3 dashboards KPI (occupation, facturation, rentabilité).
export const pct = (v: number | null) =>
  v == null ? '—' : (v * 100).toLocaleString('fr-MG', { maximumFractionDigits: 1 }) + ' %';
export const num = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('fr-MG', { maximumFractionDigits: 1 });

type Accent = 'pos' | 'neg';

// Écart par rapport au mois précédent, affiché en haut à droite d'un Hero/Highlight — jamais sur
// les Stat (bruit inutile sur du détail). `points` : différence brute ×100, pour des ratios déjà
// en fraction (occupancyRate, netOperatingMargin...). `percent` : variation relative, pour des
// montants (CA, encaissement...) — masqué si le mois précédent vaut 0 (division impossible) ou est
// indisponible (pas encore chargé, ou hors période couverte par les vues KPI).
export const DeltaBadge: React.FC<{
  current: number | null;
  previous: number | null | undefined;
  kind: 'points' | 'percent';
  invert?: boolean;
  variant?: 'light' | 'dark';
  title?: string;
}> = ({ current, previous, kind, invert, variant = 'light', title }) => {
  if (current == null || previous == null) return null;
  const delta = kind === 'percent'
    ? (previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100)
    : (current - previous) * 100;
  if (delta == null) return null;

  const isFlat = Math.abs(delta) < 0.05;
  const isGood = invert ? delta < 0 : delta > 0;
  const Icon = isFlat ? Minus : isGood ? ArrowUpRight : ArrowDownRight;
  const label = `${delta > 0 ? '+' : ''}${delta.toLocaleString('fr-MG', { maximumFractionDigits: 1 })}${kind === 'points' ? ' pts' : ' %'}`;

  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 px-2 py-1 rounded-full text-[10px] font-bold tracking-wide whitespace-nowrap',
        variant === 'dark'
          ? isFlat ? 'bg-white/10 text-white/50' : isGood ? 'bg-teal-400/20 text-teal-300' : 'bg-red-400/20 text-red-300'
          : isFlat ? 'bg-stone-100 text-on-surface-variant/50' : isGood ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-600',
      )}
    >
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
};

// Chiffre héros — un seul par page, en haut à gauche (repère Z/F), la plus grande taille de texte
// du dashboard. Réservé à LA métrique qui résume la page à elle seule.
export const Hero: React.FC<{ label: string; value: React.ReactNode; caption?: string; accent?: Accent; trend?: React.ReactNode }> = ({ label, value, caption, accent, trend }) => (
  <div className="bg-stone-900 text-white rounded-[2rem] p-8 md:p-10 flex flex-col justify-between min-h-[220px] organic-shadow">
    <div className="flex items-start justify-between gap-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">{label}</p>
      {trend}
    </div>
    <p className={cn(
      'font-display italic text-5xl md:text-6xl leading-none mt-4',
      accent === 'pos' ? 'text-teal-300' : accent === 'neg' ? 'text-red-300' : 'text-white',
    )}>{value}</p>
    {caption && <p className="text-xs text-white/50 mt-4 font-mono">{caption}</p>}
  </div>
);

// 2-3 métriques de second plan, à côté du héros — plus petites que lui, plus grandes que les Stat.
export const Highlight: React.FC<{ label: string; value: React.ReactNode; caption?: string; accent?: Accent; trend?: React.ReactNode }> = ({ label, value, caption, accent, trend }) => (
  <div className="bg-white rounded-3xl border border-stone-200/60 organic-shadow p-6 flex flex-col justify-between min-h-[104px]">
    <div className="flex items-start justify-between gap-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">{label}</p>
      {trend}
    </div>
    <p className={cn(
      'font-mono text-2xl md:text-3xl font-bold mt-2',
      accent === 'pos' ? 'text-teal-700' : accent === 'neg' ? 'text-red-600' : 'text-on-surface',
    )}>{value}</p>
    {caption && <p className="text-[10px] text-on-surface-variant/40 mt-1">{caption}</p>}
  </div>
);

// Métriques de détail — grille dense, lue en dernier (bas de page, sens de lecture F).
export const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string; accent?: Accent }> = ({ label, value, hint, accent }) => (
  <div className="rounded-2xl border border-stone-100 bg-stone-50/70 p-4">
    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">{label}</p>
    <p className={cn(
      'mt-1.5 font-mono text-lg font-bold',
      accent === 'pos' ? 'text-teal-700' : accent === 'neg' ? 'text-red-600' : 'text-on-surface',
    )}>{value}</p>
    {hint && <p className="text-[10px] text-on-surface-variant/40 mt-0.5">{hint}</p>}
  </div>
);

export const SectionCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
    <div className="p-6 border-b border-stone-100 flex items-center gap-2">
      <span className="text-on-surface-variant/50">{icon}</span>
      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/50">{title}</h4>
    </div>
    <div className="p-6">{children}</div>
  </div>
);
