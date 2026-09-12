import React from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { Invoice } from '../../api/invoices';
import { formatDate as fmtDate, formatDateTime as fmtDateTime, formatCurrency as fmtAmount } from '../../lib/format';

export interface MoneyRow {
  label:  string;
  value:  string;
  accent?: 'pos' | 'neg';
}

interface Props {
  invoice: Invoice;
  isDraft: boolean;
  // Lignes sous le Total — libellés/conditions différents pour une facture (payé/reste à payer)
  // qu'un avoir (remboursé/reste à rembourser) : calculées par l'appelant, la carte ne fait
  // qu'afficher.
  movementRows?: MoneyRow[];
  canEditItems?: boolean;
  onDeleteItem?: (itemId: string) => void;
  isDeletingItem?: boolean;
  // Formulaire "ajouter une ligne / une remise" (facture STANDARD uniquement) — rendu sous le
  // tableau, jamais imprimé (le composant appelant l'enveloppe déjà dans .no-print).
  itemsFooter?: React.ReactNode;
}

// Rendu du document imprimable — partagé par InvoiceView.tsx (facture STANDARD) et
// InvoiceDocument.tsx (acompte/avoir) pour qu'une facture ait TOUJOURS le même rendu, quelle que
// soit la page depuis laquelle on la consulte. Ne contient aucune logique métier propre à un type
// de document : tout ce qui varie (édition, mouvements d'argent) est injecté par l'appelant.
export const InvoiceDocumentCard: React.FC<Props> = ({
  invoice, isDraft, movementRows = [], canEditItems, onDeleteItem, isDeletingItem, itemsFooter,
}) => {
  const { t } = useTranslation();
  const subtotal = invoice.totalAmount - invoice.taxAmount;

  const documentDetails: { label: string; value: React.ReactNode }[] = [
    { label: t('invoice.issued'), value: isDraft ? '—' : fmtDate(invoice.issuedAt) },
    {
      label: t('invoice.number'),
      value: (
        <>
          {invoice.number ?? t('invoice.draft')}
          {isDraft && <span className="ml-2 text-[9px] font-bold uppercase tracking-widest text-amber-600 align-middle">{t('invoice.notYetValidated')}</span>}
        </>
      ),
    },
    { label: t('invoice.stayCheckIn'), value: invoice.booking.checkedInAt ? fmtDateTime(invoice.booking.checkedInAt) : fmtDate(invoice.booking.arrival) },
    { label: t('invoice.stayCheckOut'), value: invoice.booking.checkedOutAt ? fmtDateTime(invoice.booking.checkedOutAt) : fmtDate(invoice.booking.departure) },
    { label: t('invoice.registrationRef'), value: `#${invoice.bookingId.slice(-8).toUpperCase()}` },
    ...(invoice.relatesToInvoice ? [{ label: t('invoice.relatesTo'), value: invoice.relatesToInvoice.number ?? '—' }] : []),
  ];

  return (
    <div
      id="invoice-print-area"
      className="lg:col-span-2 print:col-span-full bg-white p-8 md:p-14 rounded-3xl shadow-sm border border-stone-200 flex flex-col gap-10"
    >
      {/* Branding */}
      <div className="flex justify-between items-start">
        <div className="w-24 h-24 flex items-center justify-center">
          <img src="/logo.png" alt="Natura Lodge Logo" />
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest">Natura Lodge</p>
          <p className="text-[10px] text-on-surface-variant/60 leading-relaxed">Madagascar - Manambato</p>
        </div>
      </div>

      {/* Bill To + Document Detail */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
        <div>
          <h5 className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-3 pb-2 border-b border-stone-100">{t('invoice.billTo')}</h5>
          <p className="text-base font-bold text-on-surface">{invoice.booking.guest.name}</p>
          <p className="text-[10px] text-on-surface-variant/60 mt-1">{invoice.booking.guest.email}</p>
        </div>
        <div>
          <h5 className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-3 pb-2 border-b border-stone-100">{t('invoice.documentDetail')}</h5>
          <div className="grid grid-cols-2 gap-y-3 text-[10px]">
            {documentDetails.map((d, i) => (
              <div key={i}>
                <p className="font-bold opacity-40 uppercase tracking-widest">{d.label}</p>
                <p className="font-mono mt-1">{d.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Line items */}
      <div>
        <h5 className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-4 pb-2 border-b border-stone-100">{t('invoice.items')}</h5>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-stone-200">
                {[t('invoice.itemDescription'), t('invoice.itemQuantity'), t('invoice.itemUnitPrice'), t('invoice.total')].map((h, i) => (
                  <th key={i} className={cn('py-3 text-[10px] font-bold uppercase tracking-widest opacity-40 whitespace-nowrap', i > 0 && 'text-right', i === 1 && 'text-center')}>{h}</th>
                ))}
                {canEditItems && <th className="no-print w-10" aria-hidden />}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {invoice.items.map(item => (
                <tr key={item.id} className="print:break-inside-avoid">
                  <td className="py-4 text-sm font-medium text-on-surface">
                    {item.description}
                    {item.source === 'manual' && (
                      item.discountRate !== null || item.total < 0 ? (
                        <span className="no-print ml-2 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[8px] font-bold uppercase tracking-widest align-middle">
                          {item.discountRate !== null ? `− ${item.discountRate} %` : t('invoice.discountBadge')}
                        </span>
                      ) : (
                        <span className="no-print ml-2 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[8px] font-bold uppercase tracking-widest align-middle">
                          {t('invoice.manualItem')}
                        </span>
                      )
                    )}
                  </td>
                  <td className="py-4 text-center text-xs font-mono">{item.quantity}</td>
                  <td className="py-4 text-right text-xs font-mono">{fmtAmount(item.unitPrice)}</td>
                  <td className="py-4 text-right text-sm font-bold whitespace-nowrap">{fmtAmount(item.total)}</td>
                  {canEditItems && (
                    <td className="no-print py-4 text-right">
                      {item.source === 'manual' && onDeleteItem && (
                        <button
                          onClick={() => onDeleteItem(item.id)}
                          disabled={isDeletingItem}
                          className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title={t('invoice.removeItem')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {itemsFooter && <div className="no-print mt-4">{itemsFooter}</div>}
      </div>

      {/* Totals — largeur bornée + justify-between (plutôt qu'un gap fixe) pour rester lisible sur
          mobile et ne pas s'étirer inutilement sur un grand écran. */}
      <div className="flex flex-col items-end pt-6 border-t-2 border-stone-900">
        <div className="w-full max-w-[280px] space-y-3">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
            <span>{t('invoice.subtotal')}</span>
            <span className="font-mono text-on-surface">{fmtAmount(subtotal)}</span>
          </div>
          {invoice.taxAmount > 0 && (
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
              <span>{t('invoice.tax')}</span>
              <span className="font-mono text-on-surface">{fmtAmount(invoice.taxAmount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-stone-100">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-on-surface-variant">{t('invoice.total')}</span>
            <span className="text-3xl font-display italic text-primary leading-none">{fmtAmount(invoice.totalAmount)}</span>
          </div>
          {movementRows.map((row, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center justify-between text-[10px] font-bold uppercase tracking-widest',
                row.accent === 'pos' ? 'text-teal-600' : row.accent === 'neg' ? 'text-red-600' : 'text-on-surface-variant/50',
              )}
            >
              <span>{row.label}</span>
              <span className="font-mono">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {invoice.notes && (
        <p className="text-[10px] text-on-surface-variant/50 italic border-t border-stone-100 pt-4">{invoice.notes}</p>
      )}
    </div>
  );
};
