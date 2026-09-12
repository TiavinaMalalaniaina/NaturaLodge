import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../lib/format';
import { Hero, Highlight, Stat, pct, num } from '../components/kpi/KpiWidgets';
import type { KpiOutletContext } from './KpiLayout';

// Héros = encaissement net : c'est l'argent réellement entré en caisse, la seule métrique qui
// résume la santé de l'encaissement. Les créances en attente (risque) et le taux de recouvrement
// (contexte) viennent juste après, en haut à droite.
export const KpiBilling: React.FC = () => {
  const { t } = useTranslation();
  const { data } = useOutletContext<KpiOutletContext>();
  const { billing: b } = data;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Hero label={t('kpi.netCollected')} value={formatCurrency(b.netCollected)} accent="pos" />
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Highlight
            label={t('kpi.receivables')}
            value={formatCurrency(b.clientReceivablesEndOfPeriod)}
            accent={b.clientReceivablesEndOfPeriod > 0 ? 'neg' : undefined}
          />
          <Highlight label={t('kpi.recoveryRate')} value={pct(b.recoveryRate)} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={t('kpi.invoicesIssued')} value={num(b.standardInvoicesIssued)} hint={`${t('kpi.cancelledInvoices')} ${num(b.cancelledInvoices)}`} />
        <Stat label={t('kpi.netInvoices')} value={num(b.netInvoices)} />
        <Stat label={t('kpi.averageBasket')} value={b.averageBasket == null ? '—' : formatCurrency(b.averageBasket)} />
        <Stat label={t('kpi.grossCollected')} value={formatCurrency(b.grossCollected)} />
        <Stat label={t('kpi.paymentRefunds')} value={formatCurrency(b.paymentRefunds)} />
        <Stat label={t('kpi.paymentVoids')} value={formatCurrency(b.paymentVoids)} />
        <Stat label={t('kpi.paymentCancellationRate')} value={pct(b.paymentCancellationRate)} />
      </div>
    </div>
  );
};
