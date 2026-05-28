import { api } from './client';
import { Booking } from '../types';

interface ApiBooking {
  id: string; guestId: string; roomId: string;
  arrival: string; departure: string; status: string;
  totalAmount: number; notes?: string;
  nights?: number;
  effectiveStatus?: string;
  guest: { id: string; name: string; email: string; avatar?: string; status: string };
  room: { id: string; number: string; type: string; category: string; rate: number };
}

export type EffectiveStatus =
  | 'upcoming'
  | 'due_checkin'
  | 'in_progress'
  | 'overdue'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled';

const BOOKING_STATUS: Record<string, Booking['status']> = {
  CONFIRMED: 'confirmed', CHECKED_IN: 'checked-in', CHECKED_OUT: 'checked-out',
  AWAITING: 'awaiting', CANCELLED: 'cancelled',
};

/** Calcul client-side de secours si le backend ne renvoie pas effectiveStatus */
function deriveEffectiveStatus(arrival: string, departure: string, status: Booking['status']): EffectiveStatus {
  const now  = new Date();
  const arr  = new Date(arrival);
  const dep  = new Date(departure);

  if (status === 'cancelled')    return 'cancelled';
  if (status === 'checked-out')  return 'checked_out';
  if (status === 'checked-in') {
    return now > dep ? 'overdue' : 'in_progress';
  }
  if (now < arr) {
    const sameDay = arr.toDateString() === now.toDateString();
    return sameDay ? 'due_checkin' : 'upcoming';
  }
  if (now >= arr && now <= dep)  return 'due_checkin';
  return 'overdue';
}

export function normalizeBooking(b: ApiBooking): RichBooking {
  const arrival   = b.arrival.split('T')[0];
  const departure = b.departure.split('T')[0];
  const status    = BOOKING_STATUS[b.status] ?? 'confirmed';

  const nights = b.nights ?? Math.max(1, Math.round(
    (new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / 86_400_000
  ));

  const effectiveStatus: EffectiveStatus = (b.effectiveStatus as EffectiveStatus)
    ?? deriveEffectiveStatus(arrival, departure, status);

  return {
    id: b.id, guestId: b.guestId, guestName: b.guest.name,
    roomId: b.roomId, roomNumber: b.room.number, roomType: b.room.type,
    arrival, departure, status, totalAmount: b.totalAmount,
    nights, effectiveStatus,
    guest: b.guest, room: b.room,
  };
}

export interface RichBooking extends Booking {
  nights:          number;
  effectiveStatus: EffectiveStatus;
  guest: { id: string; name: string; email: string; avatar?: string; status: string };
  room:  { id: string; number: string; type: string; category: string; rate: number };
}

export interface BookingParams {
  page?:      number;
  limit?:     number;
  status?:    string;
  date?:      string;
  startDate?: string; // pour le planning grid (range overlap)
  endDate?:   string;
  search?:    string;
  sort?:      'arrival' | 'departure' | 'createdAt' | 'totalAmount';
  order?:     'asc' | 'desc';
}

export interface PaginatedBookings {
  data: RichBooking[];
  meta: {
    total: number; page: number; limit: number;
    totalPages: number; hasNextPage: boolean; hasPrevPage: boolean;
  };
}

export const fetchBookings = async (params?: BookingParams): Promise<PaginatedBookings> => {
  const { data } = await api.get<{ data: ApiBooking[]; meta: PaginatedBookings['meta'] }>('/bookings', { params });
  return { data: data.data.map(normalizeBooking), meta: data.meta };
};

export const updateBookingStatus = async (id: string, status: string): Promise<RichBooking> => {
  const { data } = await api.patch<ApiBooking>(`/bookings/${id}/status`, { status });
  return normalizeBooking(data);
};

export const createBooking = async (payload: {
  guestId: string; roomId: string; arrival: string;
  departure: string; totalAmount: number; notes?: string;
}): Promise<RichBooking> => {
  const { data } = await api.post<ApiBooking>('/bookings', payload);
  return normalizeBooking(data);
};
