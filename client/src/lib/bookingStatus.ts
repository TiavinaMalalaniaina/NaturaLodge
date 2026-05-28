import { EffectiveStatus } from '../api/bookings';

export const EFFECTIVE_STATUS_LABEL: Record<EffectiveStatus, string> = {
  upcoming:     'Upcoming',
  due_checkin:  'Due Check-in',
  in_progress:  'In Progress',
  overdue:      'Overdue',
  checked_in:   'Checked In',
  checked_out:  'Checked Out',
  cancelled:    'Cancelled',
};

export const EFFECTIVE_STATUS_CLASS: Record<EffectiveStatus, string> = {
  upcoming:     'bg-teal-50   text-teal-600   border-teal-100',
  due_checkin:  'bg-amber-50  text-amber-600  border-amber-100',
  in_progress:  'bg-zinc-900  text-white       border-zinc-900',
  overdue:      'bg-red-50    text-red-600    border-red-100',
  checked_in:   'bg-zinc-900  text-white       border-zinc-900',
  checked_out:  'bg-stone-50  text-stone-400  border-stone-200',
  cancelled:    'bg-stone-50  text-stone-400  border-stone-200',
};
