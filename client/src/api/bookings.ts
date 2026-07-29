import { api } from './client';

export interface BookingRoomEntry {
  id: string;
  roomId: string;
  arrival: string;
  departure: string;
  roomRate: number;
  room: { id: string; number: string; type: string; rate: number };
}

interface ApiBookingRoom {
  id: string; roomId: string;
  arrival: string; departure: string; roomRate: number;
  room: {
    id: string; number: string; rateOverride: number | null;
    roomType: { id: string; name: string; rate: number };
  };
}

function normalizeBookingRoom(br: ApiBookingRoom): BookingRoomEntry {
  return {
    id:        br.id,
    roomId:    br.roomId,
    arrival:   br.arrival.split('T')[0],
    departure: br.departure.split('T')[0],
    roomRate:  br.roomRate,
    room: {
      id:     br.room.id,
      number: br.room.number,
      type:   br.room.roomType.name,
      rate:   br.room.rateOverride ?? br.room.roomType.rate,
    },
  };
}

interface ApiBooking {
  id: string; guestId: string;
  arrival: string; departure: string; status: string;
  totalAmount: number; notes?: string;
  nights?: number; effectiveStatus?: string;
  guest: { id: string; name: string; email: string; avatar?: string; status: string };
  rooms: ApiBookingRoom[];
}

export type EffectiveStatus =
  | 'upcoming'
  | 'due_checkin'
  | 'in_progress'
  | 'overdue'
  | 'checked_out'
  | 'cancelled';

export type BookingStatus = 'confirmed' | 'checked-in' | 'checked-out' | 'awaiting' | 'cancelled';

const BOOKING_STATUS: Record<string, BookingStatus> = {
  CONFIRMED: 'confirmed', CHECKED_IN: 'checked-in', CHECKED_OUT: 'checked-out',
  AWAITING: 'awaiting', CANCELLED: 'cancelled',
};

function deriveEffectiveStatus(arrival: string, departure: string, status: BookingStatus): EffectiveStatus {
  const now = new Date();
  const arr = new Date(arrival);
  const dep = new Date(departure);
  if (status === 'cancelled')   return 'cancelled';
  if (status === 'checked-out') return 'checked_out';
  if (status === 'checked-in')  return now > dep ? 'overdue' : 'in_progress';
  if (now < arr) return arr.toDateString() === now.toDateString() ? 'due_checkin' : 'upcoming';
  if (now >= arr && now <= dep) return 'due_checkin';
  return 'overdue';
}

export interface RichBooking {
  id: string;
  guestId: string;
  guestName: string;
  arrival: string;
  departure: string;
  status: BookingStatus;
  totalAmount: number;
  nights: number;
  effectiveStatus: EffectiveStatus;
  guest: { id: string; name: string; email: string; avatar?: string; status: string };
  rooms: BookingRoomEntry[];
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

  const rooms: BookingRoomEntry[] = b.rooms.map(normalizeBookingRoom);

  return {
    id: b.id, guestId: b.guestId, guestName: b.guest.name,
    arrival, departure, status, totalAmount: b.totalAmount,
    nights, effectiveStatus, guest: b.guest, rooms,
  };
}

export interface BookingParams {
  page?:      number;
  limit?:     number;
  status?:    string;
  date?:      string;
  startDate?: string;
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

export const fetchBooking = async (id: string): Promise<RichBooking> => {
  const { data } = await api.get<ApiBooking>(`/bookings/${id}`);
  return normalizeBooking(data);
};

export const fetchBookings = async (params?: BookingParams): Promise<PaginatedBookings> => {
  const { data } = await api.get<{ data: ApiBooking[]; meta: PaginatedBookings['meta'] }>('/bookings', { params });
  return { data: data.data.map(normalizeBooking), meta: data.meta };
};

export const updateBookingStatus = async (id: string, status: string): Promise<RichBooking> => {
  const { data } = await api.patch<ApiBooking>(`/bookings/${id}/status`, { status });
  return normalizeBooking(data);
};

export const reassignRoom = async (
  bookingId: string,
  oldRoomId: string,
  newRoomId: string,
  arrival?: string,
  departure?: string,
  roomRate?: number,
): Promise<RichBooking> => {
  const { data } = await api.patch<ApiBooking>(`/bookings/${bookingId}/reassign`, {
    oldRoomId, newRoomId,
    ...(arrival   ? { arrival:   `${arrival}T00:00:00.000Z` }   : {}),
    ...(departure ? { departure: `${departure}T00:00:00.000Z` } : {}),
    ...(roomRate  ? { roomRate } : {}),
  });
  return normalizeBooking(data);
};

export const addBookingRoom = async (
  bookingId: string,
  payload: { roomId: string; arrival?: string; departure?: string; roomRate?: number },
): Promise<RichBooking> => {
  const { data } = await api.post<ApiBooking>(`/bookings/${bookingId}/rooms`, {
    roomId: payload.roomId,
    ...(payload.arrival   ? { arrival:   `${payload.arrival}T00:00:00.000Z` }   : {}),
    ...(payload.departure ? { departure: `${payload.departure}T00:00:00.000Z` } : {}),
    ...(payload.roomRate  ? { roomRate: payload.roomRate } : {}),
  });
  return normalizeBooking(data);
};

export const removeBookingRoom = async (bookingId: string, roomId: string): Promise<RichBooking> => {
  const { data } = await api.delete<ApiBooking>(`/bookings/${bookingId}/rooms/${roomId}`);
  return normalizeBooking(data);
};

export const createBooking = async (payload: {
  guestId: string;
  arrival: string;
  departure: string;
  rooms: { roomId: string; roomRate: number; arrival?: string; departure?: string }[];
  totalAmount: number;
  notes?: string;
}): Promise<RichBooking> => {
  const { data } = await api.post<ApiBooking>('/bookings', payload);
  return normalizeBooking(data);
};
