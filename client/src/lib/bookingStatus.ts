import { EffectiveStatus } from '../api/bookings';

export const EFFECTIVE_STATUS_LABEL: Record<EffectiveStatus, string> = {
  upcoming:    'Upcoming',
  due_checkin: 'Due Check-in',
  in_progress: 'In Progress',
  overdue:     'Overdue',
  awaiting:    'Awaiting',
  checked_out: 'Checked Out',
  cancelled:   'Cancelled',
};

export const EFFECTIVE_STATUS_I18N_KEY: Record<EffectiveStatus, string> = {
  upcoming:    'status.upcoming',
  due_checkin: 'status.dueCheckin',
  in_progress: 'status.inProgress',
  overdue:     'status.overdue',
  awaiting:    'status.awaiting',
  checked_out: 'status.checkedOut',
  cancelled:   'status.cancelled',
};

export const EFFECTIVE_STATUS_CLASS: Record<EffectiveStatus, string> = {
  upcoming:    'bg-teal-50  text-teal-600  border-teal-100',
  due_checkin: 'bg-amber-50 text-amber-600 border-amber-100',
  in_progress: 'bg-zinc-900 text-white     border-zinc-900',
  overdue:     'bg-red-50   text-red-600   border-red-100',
  awaiting:    'bg-amber-50 text-amber-600 border-amber-100',
  checked_out: 'bg-stone-50 text-stone-400 border-stone-200',
  cancelled:   'bg-stone-50 text-stone-400 border-stone-200',
};

export type StatusActionKey = 'confirm' | 'checkin' | 'checkout' | 'forceOut' | 'revert' | 'revertCancel';

// Confirmation copy shared by every screen that changes a booking's DB status
// (Reservations grid, BookingDetail, Dashboard quick check-in) so the wording stays consistent.
export const STATUS_ACTIONS: Record<StatusActionKey, { status: string; titleKey: string; messageKey: string; variant: 'danger' | 'warning' }> = {
  confirm:      { status: 'CONFIRMED',   titleKey: 'reservations.confirmBooking',             messageKey: 'reservations.confirmBookingMessage',        variant: 'warning' },
  checkin:      { status: 'CHECKED_IN',  titleKey: 'bookingDetail.confirmCheckinTitle',       messageKey: 'bookingDetail.confirmCheckinMessage',       variant: 'warning' },
  checkout:     { status: 'CHECKED_OUT', titleKey: 'bookingDetail.confirmCheckoutTitle',      messageKey: 'bookingDetail.confirmCheckoutMessage',      variant: 'warning' },
  forceOut:     { status: 'CHECKED_OUT', titleKey: 'bookingDetail.confirmForceOutTitle',      messageKey: 'bookingDetail.confirmForceOutMessage',      variant: 'danger' },
  revert:       { status: 'CONFIRMED',   titleKey: 'bookingDetail.confirmRevertTitle',        messageKey: 'bookingDetail.confirmRevertMessage',        variant: 'warning' },
  revertCancel: { status: 'AWAITING',    titleKey: 'bookingDetail.confirmRevertCancelTitle',  messageKey: 'bookingDetail.confirmRevertCancelMessage',  variant: 'warning' },
};
