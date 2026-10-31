import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { formatCurrency } from '../lib/format';
import { DeltaBadge, Hero, Highlight, Stat, pct, num } from '../components/kpi/KpiWidgets';
import { OccupancyTargetCard } from '../components/kpi/OccupancyTargetCard';
import type { KpiOutletContext } from './KpiLayout';

const sum = <T,>(rows: T[], pick: (r: T) => number) => rows.reduce((s, r) => s + pick(r), 0);
const ratio = (a: number, b: number) => (b === 0 ? null : a / b);

// Ordre de lecture Z : le taux d'occupation (héros, en haut à gauche) résume la page à lui seul,
// l'objectif du mois le qualifie juste en dessous ; le CA réel et l'écart au CA théorique en haut
// à droite. Le reste (nuitées, ADR/RevPAR réel vs théorique, tables par type/par chambre) est du
// détail, lu ensuite de haut en bas.
export const KpiOccupancy: React.FC = () => {
  const { t } = useTranslation();
  const { data, prevData } = useOutletContext<KpiOutletContext>();
  const { occupancy: o, byRoomType, byRoom, period } = data;
  const prevO = prevData?.occupancy;
  const vsPrevMonth = t('kpi.vsPreviousMonth');

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="flex flex-col gap-4">
          <Hero
            label={t('kpi.occupancyRate')}
            value={pct(o.occupancyRate)}
            caption={`${num(o.roomNightsSold)} / ${num(o.roomNightsAvailable)} ${t('kpi.roomNightsAvailable').toLowerCase()}`}
            trend={<DeltaBadge current={o.occupancyRate} previous={prevO?.occupancyRate} kind="points" variant="dark" title={vsPrevMonth} />}
          />
          <OccupancyTargetCard month={period.month} targetRate={o.occupancyTargetRate} gap={o.occupancyGapToTarget} />
        </div>
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Highlight
            label={t('kpi.accommodationRevenueNet')}
            value={formatCurrency(o.accommodationRevenueNet)}
            trend={<DeltaBadge current={o.accommodationRevenueNet} previous={prevO?.accommodationRevenueNet} kind="percent" title={vsPrevMonth} />}
          />
          <Highlight
            label={t('kpi.revenueVariance')}
            value={formatCurrency(o.revenueVariance)}
            caption={pct(o.revenueVariancePct)}
            accent={o.revenueVariance >= 0 ? 'pos' : 'neg'}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={t('kpi.roomsAvailable')} value={num(o.roomsAvailable)} />
        <Stat label={t('kpi.roomNightsAvailable')} value={num(o.roomNightsAvailable)} />
        <Stat label={t('kpi.roomNightsSold')} value={num(o.roomNightsSold)} />
        <Stat label={t('kpi.theoreticalRevenue')} value={formatCurrency(o.theoreticalRevenue)} hint={t('kpi.theoreticalRevenueHint')} />
        <Stat label={t('kpi.adr')} value={o.adr == null ? '—' : formatCurrency(o.adr)} />
        <Stat label={t('kpi.adrTheoretical')} value={o.adrTheoretical == null ? '—' : formatCurrency(o.adrTheoretical)} />
        <Stat label={t('kpi.revpar')} value={o.revpar == null ? '—' : formatCurrency(o.revpar)} />
        <Stat label={t('kpi.revparTheoretical')} value={o.revparTheoretical == null ? '—' : formatCurrency(o.revparTheoretical)} />
      </div>

      {byRoomType.length > 0 && (
        <div className="bg-white rounded-3xl border border-stone-200 p-6 overflow-hidden">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-4">{t('kpi.roomType')}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left">
                  {[t('kpi.roomType'), t('kpi.roomNightsSold'), t('kpi.occupancyRate'), t('kpi.theoreticalRevenue'), t('kpi.realisedRoomRevenue')].map((h, i) => (
                    <th key={i} className={cn('py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40', i > 0 && 'text-right')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {byRoomType.map(r => (
                  <tr key={r.roomTypeId}>
                    <td className="py-2.5 font-medium text-on-surface">{r.roomTypeName}</td>
                    <td className="py-2.5 text-right font-mono">{num(r.roomNightsSold)} / {num(r.roomNightsAvailable)}</td>
                    <td className="py-2.5 text-right font-mono">{pct(r.occupancyRate)}</td>
                    <td className="py-2.5 text-right font-mono">{formatCurrency(r.theoreticalRevenue)}</td>
                    <td className="py-2.5 text-right font-mono">{formatCurrency(r.realisedRoomRevenue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-200 font-bold">
                  <td className="py-2.5 text-on-surface">{t('common.total')}</td>
                  <td className="py-2.5 text-right font-mono">{num(sum(byRoomType, r => r.roomNightsSold))} / {num(sum(byRoomType, r => r.roomNightsAvailable))}</td>
                  <td className="py-2.5 text-right font-mono">{pct(ratio(sum(byRoomType, r => r.roomNightsSold), sum(byRoomType, r => r.roomNightsAvailable)))}</td>
                  <td className="py-2.5 text-right font-mono">{formatCurrency(sum(byRoomType, r => r.theoreticalRevenue))}</td>
                  <td className="py-2.5 text-right font-mono">{formatCurrency(sum(byRoomType, r => r.realisedRoomRevenue))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {byRoom.length > 0 && (
        <div className="bg-white rounded-3xl border border-stone-200 p-6 overflow-hidden">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-4">{t('kpi.byRoomTitle')}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left">
                  {[t('kpi.room'), t('kpi.category'), t('kpi.nightlyRate'), t('kpi.roomNightsSold'), t('kpi.occupancyRate'), t('kpi.theoreticalRevenue'), t('kpi.realisedRoomRevenue')].map((h, i) => (
                    <th key={i} className={cn('py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40', i > 1 && 'text-right')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {byRoom.map(r => (
                  <tr key={r.roomId} className={cn(r.status === 'maintenance' && 'opacity-45')}>
                    <td className="py-2.5 font-medium text-on-surface whitespace-nowrap">
                      {r.roomNumber}
                      {r.status === 'maintenance' && <span className="ml-2 text-[9px] font-bold uppercase tracking-widest text-amber-600">{t('status.maintenance')}</span>}
                    </td>
                    <td className="py-2.5 text-on-surface-variant">{r.roomTypeName}</td>
                    <td className="py-2.5 text-right font-mono">{formatCurrency(r.nightlyRate)}</td>
                    <td className="py-2.5 text-right font-mono">{num(r.roomNightsSold)} / {num(r.roomNightsAvailable)}</td>
                    <td className="py-2.5 text-right font-mono">{pct(r.occupancyRate)}</td>
                    <td className="py-2.5 text-right font-mono">{formatCurrency(r.theoreticalRevenue)}</td>
                    <td className="py-2.5 text-right font-mono">{formatCurrency(r.realisedRoomRevenue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {(() => {
                  // Nuitées disponibles / taux d'occupation du TOTAL n'incluent que les chambres hors
                  // maintenance, comme "Chambres disponibles" en haut de page — une chambre en
                  // maintenance affichée en grisé ci-dessus ne doit pas gonfler artificiellement le total.
                  const available = byRoom.filter(r => r.status !== 'maintenance');
                  const totalSold = sum(available, r => r.roomNightsSold);
                  const totalAvail = sum(available, r => r.roomNightsAvailable);
                  return (
                    <tr className="border-t-2 border-stone-200 font-bold">
                      <td className="py-2.5 text-on-surface">{t('common.total')}</td>
                      <td />
                      <td />
                      <td className="py-2.5 text-right font-mono">{num(totalSold)} / {num(totalAvail)}</td>
                      <td className="py-2.5 text-right font-mono">{pct(ratio(totalSold, totalAvail))}</td>
                      <td className="py-2.5 text-right font-mono">{formatCurrency(sum(byRoom, r => r.theoreticalRevenue))}</td>
                      <td className="py-2.5 text-right font-mono">{formatCurrency(sum(byRoom, r => r.realisedRoomRevenue))}</td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
