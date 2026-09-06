import { BookingStatus, PaymentStatus } from '../api/bookings';
import { InvoiceStatus, InvoiceKind } from '../api/invoices';
import { RoomStatus, StaffRole, StaffMember } from '../types';

export const BOOKING_STATUS_CLASS: Record<BookingStatus, string> = {
  confirmed:            'text-teal-600',
  'checked-in':         'text-zinc-900',
  'checked-out':        'text-stone-400', // legacy
  'checked-out-unpaid': 'text-rose-500',
  'checked-out-paid':   'text-teal-600',
  closed:               'text-stone-400',
  cancelled:            'text-red-400',
  awaiting:             'text-amber-600',
};

export const INVOICE_STATUS_CLASS: Record<InvoiceStatus, string> = {
  pending:        'bg-amber-50 text-amber-700 border-amber-200',
  partially_paid: 'bg-blue-50 text-blue-700 border-blue-200',
  paid:           'bg-teal-50 text-teal-700 border-teal-200',
  refunded:       'bg-purple-50 text-purple-700 border-purple-200',
  cancelled:      'bg-stone-100 text-stone-500 border-stone-200',
};

// L'enum InvoiceStatus est pensé pour une créance. Sur un avoir (CREDIT_NOTE), c'est nous qui
// devons de l'argent : "payé" y signifie "remboursé", "en attente" = "à rembourser", etc. On garde
// le même enum en base et on ne traduit différemment que le libellé affiché.
const CREDIT_NOTE_STATUS_I18N_KEY: Record<InvoiceStatus, string> = {
  pending:        'invoice.status_cn_pending',
  partially_paid: 'invoice.status_cn_partially_paid',
  paid:           'invoice.status_cn_paid',
  refunded:       'invoice.status_refunded',
  cancelled:      'invoice.status_cancelled',
};

export function invoiceStatusI18nKey(kind: InvoiceKind, status: InvoiceStatus): string {
  return kind === 'credit_note' ? CREDIT_NOTE_STATUS_I18N_KEY[status] : `invoice.status_${status}`;
}

// Même style que INVOICE_STATUS_CLASS (badge affiché directement sur la réservation), plus
// 'no_invoice' — le cas le plus important à repérer après un check-out : aucune facture n'a
// même été générée.
export const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  ...INVOICE_STATUS_CLASS,
  no_invoice: 'bg-stone-50 text-stone-400 border-stone-200 border-dashed',
};

// Room.status n'a que 3 valeurs actives en pratique (RESERVED n'est jamais posé par le
// backend) — les maps restent partielles, avec un style "maintenance" en repli, comme
// le faisaient les ternaires locales qu'elles remplacent.
export const ROOM_STATUS_BORDER_CLASS: Partial<Record<RoomStatus, string>> = {
  available: 'border-l-status-available',
  occupied:  'border-l-status-occupied',
};

export const ROOM_STATUS_BADGE_CLASS: Partial<Record<RoomStatus, string>> = {
  available: 'bg-teal-50 text-status-available border-teal-200',
  occupied:  'bg-orange-50 text-status-occupied border-orange-200',
};

// Rôles configurables : seuls les 2 rôles historiques les plus fréquents ont un style dédié, tout
// rôle custom (ou GERANT/HOUSEKEEPING) retombe sur le style neutre par défaut du composant.
export const STAFF_ROLE_CLASS: Partial<Record<StaffRole, string>> = {
  ADMIN:   'bg-zinc-900 text-white border-zinc-900',
  MANAGER: 'bg-teal-50 text-teal-600 border-teal-200',
};

export const STAFF_STATUS_DOT_CLASS: Record<StaffMember['status'], string> = {
  active:      'bg-teal-500 shadow-sm shadow-teal-500/50',
  'on-leave':  'bg-amber-400',
  inactive:    'bg-stone-300',
};
