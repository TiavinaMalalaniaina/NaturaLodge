import { api } from './client';
import { Guest, StaffNote, Booking } from '../types';

interface ApiNote { id: string; author: string; role: string; content: string; createdAt: string }
interface ApiBooking {
  id: string; arrival: string; departure: string; status: string;
  totalAmount: number; guestId: string;
  room: { id: string; number: string; type: string };
}
interface ApiGuest {
  id: string; name: string; email: string; phone?: string;
  address?: string; city?: string; country?: string; status: string;
  memberSince: string; totalStays: number; lifetimeValue: number;
  avatar?: string; preferences: string[];
  notes: ApiNote[]; bookings?: ApiBooking[];
}

const GUEST_STATUS: Record<string, Guest['status']> = {
  VIP_ELITE: 'VIP Elite', VIP_MEMBER: 'VIP Member',
  PLATINUM_TIER: 'Platinum Tier', STANDARD: 'Standard',
};

const BOOKING_STATUS: Record<string, Booking['status']> = {
  CONFIRMED: 'confirmed', CHECKED_IN: 'checked-in', CHECKED_OUT: 'checked-out',
  AWAITING: 'awaiting', CANCELLED: 'cancelled',
};

export function normalizeGuest(g: ApiGuest): Guest & { bookings?: Booking[] } {
  return {
    id: g.id,
    name: g.name,
    email: g.email,
    phone: g.phone ?? '',
    address: g.address ?? '',
    city: g.city ?? '',
    country: g.country ?? '',
    status: GUEST_STATUS[g.status] ?? 'Standard',
    lastStay: g.memberSince ? new Date(g.memberSince).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '—',
    memberSince: new Date(g.memberSince).getFullYear().toString(),
    totalStays: g.totalStays,
    lifetimeValue: g.lifetimeValue,
    avatar: g.avatar ?? '',
    preferences: g.preferences,
    notes: g.notes.map((n): StaffNote => ({
      id: n.id, author: n.author, role: n.role,
      date: new Date(n.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      content: n.content,
    })),
    bookings: g.bookings?.map((b): Booking => ({
      id: b.id,
      guestId: b.guestId,
      guestName: g.name,
      roomId: b.room.id,
      roomNumber: b.room.number,
      roomType: b.room.type,
      arrival: b.arrival.split('T')[0],
      departure: b.departure.split('T')[0],
      status: BOOKING_STATUS[b.status] ?? 'confirmed',
      totalAmount: b.totalAmount,
    })),
  };
}

export const fetchGuests = async (search?: string): Promise<Guest[]> => {
  const { data } = await api.get<ApiGuest[]>('/guests', { params: search ? { search } : {} });
  return data.map(normalizeGuest);
};

export const fetchGuest = async (id: string): Promise<Guest & { bookings?: Booking[] }> => {
  const { data } = await api.get<ApiGuest>(`/guests/${id}`);
  return normalizeGuest(data);
};
