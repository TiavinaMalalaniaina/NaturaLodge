import React, { Suspense } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, Percent, Receipt, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { useHotelKpis } from '../hooks/useKpi';
import { PageLoader, PageError } from '../components/QueryLoader';
import type { HotelKpis } from '../api/kpi';

export type KpiOutletContext = { data: HotelKpis; prevData?: HotelKpis };

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const previousMonthOf = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

// Un seul fetch pour les 3 dashboards (occupation, facturation, rentabilité) : le mois vit ici et
// les pages enfants lisent leur tranche de `data` via useOutletContext — pas de re-fetch en
// changeant d'onglet.
//
// Le mois vit dans l'URL (`?month=`), pas dans un useState local : chaque onglet est un composant
// lazy séparé, donc la première visite d'un onglet suspend le temps de charger son chunk — comme
// App.tsx n'a qu'un seul <Suspense> englobant tout, ça remonte KpiLayout (et perdrait un useState
// local). Le <Suspense> local ci-dessous limite déjà ce remount à l'<Outlet>, mais l'URL reste la
// source de vérité pour survivre aussi à un rafraîchissement de page ou un lien partagé.
export const KpiLayout: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const month = searchParams.get('month') || currentMonth();
  const setMonth = (value: string) => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    next.set('month', value);
    return next;
  }, { replace: true });
  const { data, isLoading, isError } = useHotelKpis(month);
  // Comparaison "vs mois précédent" affichée par les DeltaBadge des pages enfants — chargée à
  // part, sans bloquer ni faire échouer l'affichage principal si elle n'est pas encore prête.
  // `detail: false` : on n'a besoin que des agrégats globaux, pas du détail par chambre.
  const { data: prevData } = useHotelKpis(previousMonthOf(month), false);

  const tabs = [
    { path: '/kpi', label: t('kpi.section1'), icon: Percent },
    { path: '/kpi/billing', label: t('kpi.section2'), icon: Receipt },
    { path: '/kpi/profitability', label: t('kpi.section3'), icon: TrendingUp },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="font-display italic text-3xl md:text-4xl text-primary leading-none">{t('kpi.title')}</h2>
          <p className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-[0.2em] mt-2">
            {data ? `${data.period.dateFrom} → ${data.period.dateTo} · ${data.period.days} ${t('kpi.days').toLowerCase()}` : ' '}
          </p>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 block mb-1">{t('kpi.month')}</label>
          <input
            type="month" value={month} max={currentMonth()}
            onChange={e => e.target.value && setMonth(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>
      </div>

      <nav className="flex gap-1 border-b border-stone-200">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate({ pathname: tab.path, search: location.search })}
              className={cn(
                '-mb-px flex items-center gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-colors',
                isActive ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant/50 hover:text-on-surface-variant',
              )}
            >
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          );
        })}
      </nav>

      {isLoading ? <PageLoader /> : isError || !data ? <PageError /> : (
        <Suspense fallback={<PageLoader />}>
          <Outlet context={{ data, prevData } satisfies KpiOutletContext} />
        </Suspense>
      )}

      <p className="text-[10px] text-on-surface-variant/40 leading-relaxed">
        <BarChart3 className="w-3 h-3 inline mr-1 -mt-0.5" />
        {t('kpi.footnote')}
      </p>
    </div>
  );
};
