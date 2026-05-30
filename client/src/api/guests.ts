import { api } from './client';
import { Guest, StaffNote } from '../types';

// ─── API shapes ───────────────────────────────────────────────────

interface ApiNote {
  id: string;
  author: { id: string; name: string; role: string };
  content: string;
  createdAt: string;
}

interface ApiBookingRoom {
  room: {
    id: string;
    number: string;
    rateOverride: number | null;
    roomType: { name: string; category: string; rate: number };
  };
}

interface ApiBooking {
  id: string; arrival: string; departure: string;
  status: string; totalAmount: number; guestId: string;
  rooms: ApiBookingRoom[];
}

interface ApiGuest {
  id: string; name: string; email: string; phone?: string;
  address?: string; city?: string; country?: string; status: string;
  memberSince: string; totalStays: number; lifetimeValue: number;
  avatar?: string; preferences: string[];
  notes: ApiNote[]; bookings?: ApiBooking[];
}

// ─── Normalized shapes ────────────────────────────────────────────

export interface GuestBooking {
  id: string;
  arrival: string;
  departure: string;
  status: string;
  totalAmount: number;
  rooms: { room: { id: string; number: string; type: string; category: string; rate: number } }[];
}

// ─── Status maps ──────────────────────────────────────────────────

const GUEST_STATUS: Record<string, Guest['status']> = {
  VIP_ELITE: 'VIP Elite', VIP_MEMBER: 'VIP Member',
  PLATINUM_TIER: 'Platinum Tier', STANDARD: 'Standard',
};

// ─── Normalizer ───────────────────────────────────────────────────

export function normalizeGuest(g: ApiGuest): Guest & { bookings?: GuestBooking[] } {
  return {
    id: g.id, name: g.name, email: g.email,
    phone: g.phone ?? '', address: g.address ?? '',
    city: g.city ?? '', country: g.country ?? '',
    status: GUEST_STATUS[g.status] ?? 'Standard',
    lastStay: g.memberSince
      ? new Date(g.memberSince).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
      : '—',
    memberSince: new Date(g.memberSince).getFullYear().toString(),
    totalStays: g.totalStays,
    lifetimeValue: g.lifetimeValue,
    avatar: g.avatar ?? '',
    preferences: g.preferences,
    notes: g.notes.map((n): StaffNote => ({
      id: n.id,
      author: n.author,
      content: n.content,
      createdAt: n.createdAt,
    })),
    bookings: g.bookings?.map((b): GuestBooking => ({
      id: b.id,
      arrival: b.arrival.split('T')[0],
      departure: b.departure.split('T')[0],
      status: b.status,
      totalAmount: b.totalAmount,
      rooms: b.rooms.map(br => ({
        room: {
          id:       br.room.id,
          number:   br.room.number,
          type:     br.room.roomType.name,
          category: br.room.roomType.category,
          rate:     br.room.rateOverride ?? br.room.roomType.rate,
        },
      })),
    })),
  };
}

// ─── API calls ────────────────────────────────────────────────────

export interface GuestParams {
  search?: string;
  status?: string;
  page?:   number;
  limit?:  number;
}

export interface PaginatedGuests {
  data: (Guest & { bookings?: GuestBooking[] })[];
  meta: {
    total: number; page: number; limit: number;
    totalPages: number; hasNextPage: boolean; hasPrevPage: boolean;
  };
}

export const fetchGuests = async (params?: GuestParams): Promise<PaginatedGuests> => {
  const { data } = await api.get<{ data: ApiGuest[]; meta: PaginatedGuests['meta'] }>('/guests', { params });
  return { data: data.data.map(normalizeGuest), meta: data.meta };
};

export const fetchGuest = async (id: string) => {
  const { data } = await api.get<ApiGuest>(`/guests/${id}`);
  return normalizeGuest(data);
};

export const createGuest = async (payload: {
  name: string; email: string; phone?: string;
  city?: string; country?: string; status?: string;
  preferences?: string[];
}): Promise<Guest> => {
  const { data } = await api.post<ApiGuest>('/guests', payload);
  return normalizeGuest(data);
};
