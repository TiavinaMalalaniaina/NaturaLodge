import { BookingNote } from '../types';
import { api } from './client';
import { ExtraPricing } from './extras';

const EXTRA_PRICING_MAP: Record<string, ExtraPricing> = {
  PER_NIGHT: 'per_night',
  ONE_TIME:  'one_time',
};

export interface BookingRoomExtraEntry {
  id:        string;
  extraId:   string;
  name:      string;
  quantity:  number;
  unitPrice: number;
  pricing:   ExtraPricing;
}

export interface BookingRoomEntry {
  id: string;
  roomId: string;
  arrival: string;
  departure: string;
  roomRate: number;
  room: { id: string; number: string; type: string; rate: number };
  extras: BookingRoomExtraEntry[];
}

interface ApiBookingNote {
  id: string;
  author: { id: string; name: string; role: string };
  content: string;
  createdAt: string;
}

interface ApiBookingRoomExtra {
  id: string; extraId: string; quantity: number; unitPrice: number; pricing: string;
  extra: { name: string };
}

interface ApiBookingRoom {
  id: string; roomId: string;
  arrival: string; departure: string; roomRate: number;
  room: {
    id: string; number: string; rateOverride: number | null;
    roomType: { id: string; name: string; rate: number };
  };
  extras?: ApiBookingRoomExtra[];
}

function normalizeBookingNote(e: ApiBookingNote): BookingNote {
  return {
    id: e.id,
    author: e.author,
    content: e.content,
    createdAt: e.createdAt,
  }; 
}

function normalizeBookingRoomExtra(e: ApiBookingRoomExtra): BookingRoomExtraEntry {
  return {
    id:        e.id,
    extraId:   e.extraId,
    name:      e.extra.name,
    quantity:  e.quantity,
    unitPrice: e.unitPrice,
    pricing:   EXTRA_PRICING_MAP[e.pricing] ?? 'one_time',
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
    extras: (br.extras ?? []).map(normalizeBookingRoomExtra)
  };
}

interface ApiBooking {
  id: string; guestId: string;
  arrival: string; departure: string; status: string;
  totalAmount: number;
  nights?: number; effectiveStatus?: string; paymentStatus?: string;
  guest: { id: string; name: string; email: string; avatar?: string; status: string };
  rooms: ApiBookingRoom[];
  bookingNotes?: ApiBookingNote[];
}

export type EffectiveStatus =
  | 'upcoming'
  | 'due_checkin'
  | 'in_progress'
  | 'due_checkout'
  | 'overdue'
  | 'awaiting'
  | 'checked_out_unpaid'
  | 'checked_out_paid'
  | 'closed'
  | 'cancelled';

export type PaymentStatus =
  | 'no_invoice'
  | 'pending'
  | 'partially_paid'
  | 'paid'
  | 'refunded'
  | 'cancelled';

export type BookingStatus =
  | 'confirmed' | 'checked-in' | 'awaiting' | 'cancelled'
  | 'checked-out'         // legacy — ne devrait plus jamais être renvoyé par l'API après le backfill
  | 'checked-out-unpaid' | 'checked-out-paid' | 'closed';

const BOOKING_STATUS: Record<string, BookingStatus> = {
  CONFIRMED: 'confirmed', CHECKED_IN: 'checked-in', AWAITING: 'awaiting', CANCELLED: 'cancelled',
  CHECKED_OUT: 'checked-out',
  CHECKED_OUT_UNPAID: 'checked-out-unpaid', CHECKED_OUT_PAID: 'checked-out-paid', CLOSED: 'closed',
};

function deriveEffectiveStatus(arrival: string, departure: string, status: BookingStatus): EffectiveStatus {
  const now = new Date();
  const arr = new Date(arrival);
  const dep = new Date(departure);
  if (status === 'cancelled')          return 'cancelled';
  if (status === 'closed')             return 'closed';
  if (status === 'checked-out-paid')   return 'checked_out_paid';
  if (status === 'checked-out-unpaid') return 'checked_out_unpaid';
  if (status === 'checked-out')        return 'checked_out_unpaid'; // legacy, défensif
  if (status === 'checked-in') {
    if (now.toDateString() === dep.toDateString()) return 'due_checkout';
    return now > dep ? 'overdue' : 'in_progress';
  }
  if (status === 'awaiting')           return 'awaiting';
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
  paymentStatus: PaymentStatus;
  guest: { id: string; name: string; email: string; avatar?: string; status: string };
  rooms: BookingRoomEntry[];
  notes: BookingNote[];
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

  const paymentStatus: PaymentStatus = (b.paymentStatus as PaymentStatus) ?? 'no_invoice';

  const rooms: BookingRoomEntry[] = b.rooms.map(normalizeBookingRoom);


  const notes: BookingNote[] = b.bookingNotes ? b.bookingNotes.map(normalizeBookingNote) : [];

  return {
    id: b.id, guestId: b.guestId, guestName: b.guest.name,
    arrival, departure, status, totalAmount: b.totalAmount,
    nights, effectiveStatus, paymentStatus, guest: b.guest, rooms, notes
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

export const updateBookingStatus = async (id: string, status: string, refundRatePercent?: number): Promise<RichBooking> => {
  const { data } = await api.patch<ApiBooking>(`/bookings/${id}/status`, {
    status,
    ...(refundRatePercent !== undefined && { refundRatePercent }),
  });
  return normalizeBooking(data);
};

export const closeBooking = async (id: string): Promise<RichBooking> => {
  const { data } = await api.patch<ApiBooking>(`/bookings/${id}/close`);
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

export const addBookingRoomExtra = async (
  bookingId: string, roomId: string, payload: { extraId: string; quantity?: number },
): Promise<RichBooking> => {
  const { data } = await api.post<ApiBooking>(`/bookings/${bookingId}/rooms/${roomId}/extras`, payload);
  return normalizeBooking(data);
};

export const updateBookingRoomExtra = async (
  bookingId: string, roomId: string, extraId: string, quantity: number,
): Promise<RichBooking> => {
  const { data } = await api.patch<ApiBooking>(`/bookings/${bookingId}/rooms/${roomId}/extras/${extraId}`, { quantity });
  return normalizeBooking(data);
};

export const removeBookingRoomExtra = async (bookingId: string, roomId: string, extraId: string): Promise<RichBooking> => {
  const { data } = await api.delete<ApiBooking>(`/bookings/${bookingId}/rooms/${roomId}/extras/${extraId}`);
  return normalizeBooking(data);
};

export const createBooking = async (payload: {
  guestId: string;
  arrival: string;
  departure: string;
  rooms: {
    roomId: string; roomRate: number; arrival?: string; departure?: string;
    extras?: { extraId: string; quantity?: number }[];
  }[];
  totalAmount: number;
  notes?: string;
}): Promise<RichBooking> => {
  const { data } = await api.post<ApiBooking>('/bookings', payload);
  return normalizeBooking(data);
};

export const addBookingNote = async (bookingId: string, content: string ): Promise<BookingNote> => {  
  const { data } = await api.post<BookingNote>(`/bookings/${bookingId}/notes`, { content: content });
  return normalizeBookingNote(data);
};