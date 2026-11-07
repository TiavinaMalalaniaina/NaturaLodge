import { rooms } from './hotel';

// Limite du prototype, sans lien avec le stock réel de l’hôtel.
export const demoQuantityLimit = 3;
export type RoomLine = { room: number; quantity: number };
export type BookingStatus = 'pending_manager' | 'awaiting_payment' | 'payment_review' | 'confirmed' | 'expired';
export type BookingProgress = { status?: BookingStatus; paymentStatus?: 'pending' | 'not_requested' | 'awaiting_payment' | 'submitted' | 'verified'; paymentDeadline?: string };
export const demoPaymentHours = 24;

export function effectiveStatus(booking: BookingProgress, now = Date.now()): BookingStatus {
  if (booking.status === 'awaiting_payment' && booking.paymentDeadline && Date.parse(booking.paymentDeadline) <= now) return 'expired';
  return booking.status || 'pending_manager';
}

export function advanceDemo(booking: BookingProgress, action: 'approve' | 'submit_payment' | 'verify_payment', now = Date.now()): BookingProgress {
  const status = effectiveStatus(booking, now);
  if (status === 'pending_manager' && action === 'approve') return { status: 'awaiting_payment', paymentStatus: 'awaiting_payment', paymentDeadline: new Date(now + demoPaymentHours * 3600000).toISOString() };
  if (status === 'awaiting_payment' && action === 'submit_payment') return { status: 'payment_review', paymentStatus: 'submitted', paymentDeadline: booking.paymentDeadline };
  if (status === 'payment_review' && action === 'verify_payment') return { status: 'confirmed', paymentStatus: 'verified', paymentDeadline: booking.paymentDeadline };
  throw new Error('Transition de réservation non autorisée.');
}
export const maxDemoGuests = rooms.reduce((total, room) => total + room.capacity * demoQuantityLimit, 0);

export function validRoomLines(value: unknown): value is RoomLine[] {
  return Array.isArray(value) && value.length > 0 &&
    value.every(line => line && Number.isInteger(line.room) && !!rooms[line.room] &&
      Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= demoQuantityLimit) &&
    new Set(value.map(line => line.room)).size === value.length;
}

export function selectionTotals(lines: RoomLine[], nights: number) {
  return lines.reduce((total, line) => ({
    quantity: total.quantity + line.quantity,
    capacity: total.capacity + rooms[line.room].capacity * line.quantity,
    nightly: total.nightly + rooms[line.room].price * line.quantity,
    total: total.total + rooms[line.room].price * line.quantity * nights,
  }), { quantity: 0, capacity: 0, nightly: 0, total: 0 });
}
