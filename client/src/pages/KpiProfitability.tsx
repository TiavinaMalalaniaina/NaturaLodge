import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../lib/format';
import { Hero, Highlight, Stat, pct } from '../components/kpi/KpiWidgets';
import type { KpiOutletContext } from './KpiLayout';

// Héros = résultat net (le verdict de rentabilité du mois) ; la marge nette d'exploitation et le
// CA comptable qualifient immédiatement ce chiffre. Les ratios de charges (personnel, entretien,
// total) sont du détail explicatif, lus ensuite.
export const KpiProfitability: React.FC = () => {
  const { t } = useTranslation();
  const { data } = useOutletContext<KpiOutletContext>();
  const { profitability: p } = data;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Hero
          label={t('kpi.netIncome')}
          value={formatCurrency(p.netIncome)}
          accent={p.netIncome >= 0 ? 'pos' : 'neg'}
        />
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Highlight
            label={t('kpi.netOperatingMargin')}
            value={pct(p.netOperatingMargin)}
            accent={(p.netOperatingMargin ?? 0) >= 0 ? 'pos' : 'neg'}
          />
          <Highlight label={t('kpi.revenue')} value={formatCurrency(p.revenue)} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={t('kpi.personnelRatio')} value={pct(p.personnelExpenseRatio)} hint={formatCurrency(p.personnelExpense)} />
        <Stat label={t('kpi.maintenanceRatio')} value={pct(p.maintenanceExpenseRatio)} hint={formatCurrency(p.maintenanceExpense)} />
        <Stat label={t('kpi.totalExpenseRatio')} value={pct(p.totalExpenseRatio)} hint={formatCurrency(p.totalExpense)} />
        <Stat label={t('kpi.revenuePerDay')} value={p.revenuePerDay == null ? '—' : formatCurrency(p.revenuePerDay)} />
        <Stat label={t('kpi.netIncomePerRoom')} value={p.netIncomePerAvailableRoom == null ? '—' : formatCurrency(p.netIncomePerAvailableRoom)} />
      </div>
    </div>
  );
};
