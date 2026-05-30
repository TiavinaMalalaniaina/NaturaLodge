import { api } from './client';
import { Room } from '../types';

export interface ApiFeature { id: string; label: string; iconName: string }
interface ApiRoom {
  id: string; number: string; type: string; category: string;
  area: number; bedType: string; capacity: number; rate: number;
  status: string; view?: string; images: string[];
  description?: string; features: ApiFeature[];
}

const ROOM_STATUS: Record<string, Room['status']> = {
  AVAILABLE: 'available', OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance', RESERVED: 'reserved',
};

const CATEGORY_MAP: Record<string, Room['category']> = {
  SUPERIOR: 'Superior', DELUXE: 'Deluxe', SUITE: 'Suite',
  PENTHOUSE: 'Penthouse', VILLA: 'Villa', LUXURY: 'Luxury',
};

export function normalizeRoom(r: ApiRoom): Room {
  return {
    id: r.id,
    number: r.number,
    type: r.type,
    category: CATEGORY_MAP[r.category] ?? 'Suite',
    area: r.area,
    bedType: r.bedType,
    capacity: r.capacity,
    rate: r.rate,
    status: ROOM_STATUS[r.status] ?? 'available',
    view: r.view ?? '',
    images: r.images,
    description: r.description ?? '',
    features: r.features.map(f => f.id),
  };
}

export interface ConflictBooking {
  id:        string;
  arrival:   string;
  departure: string;
  guest:     { name: string };
}

export interface RoomStatusResult {
  room:      Room;
  conflicts: ConflictBooking[];
}

export const setRoomStatus = async (id: string, status: string): Promise<RoomStatusResult> => {
  const { data } = await api.patch<ApiRoom & { conflicts?: ConflictBooking[] }>(`/rooms/${id}`, {
    status: status.toUpperCase(),
  });
  return {
    room:      normalizeRoom(data),
    conflicts: (data.conflicts ?? []).map(c => ({
      ...c,
      arrival:   c.arrival.split('T')[0],
      departure: c.departure.split('T')[0],
    })),
  };
};

export interface RoomsParams {
  search?:   string;
  category?: string;
  status?:   string;
}

export const fetchRooms = async (params?: RoomsParams): Promise<Room[]> => {
  const { data } = await api.get<ApiRoom[]>('/rooms', { params });
  return data.map(normalizeRoom);
};

export const fetchRoom = async (id: string): Promise<Room> => {
  const { data } = await api.get<ApiRoom>(`/rooms/${id}`);
  return normalizeRoom(data);
};

// ─── Availability ────────────────────────────────────────────────

export const fetchAvailableRooms = async (
  arrival: string,
  departure: string,
  excludeBookingId?: string,
): Promise<Room[]> => {
  const { data } = await api.get<ApiRoom[]>('/rooms/available', {
    params: { arrival, departure, ...(excludeBookingId ? { excludeBookingId } : {}) },
  });
  return data.map(normalizeRoom);
};

// ─── Features ────────────────────────────────────────────────────

export const fetchRoomFeatures = async (): Promise<ApiFeature[]> => {
  const { data } = await api.get<ApiFeature[]>('/rooms/features');
  return data;
};

export const createRoomFeature = async (payload: { label: string; iconName: string }): Promise<ApiFeature> => {
  const { data } = await api.post<ApiFeature>('/rooms/features', payload);
  return data;
};

export const deleteRoomFeature = async (id: string): Promise<void> => {
  await api.delete(`/rooms/features/${id}`);
};

// ─── Create / Update ─────────────────────────────────────────────

export interface RoomPayload {
  number: string; type: string; category: string;
  area: number; bedType: string; capacity: number; rate: number;
  view?: string; images?: string[]; description?: string;
  featureIds?: string[];
}

export const createRoom = async (payload: RoomPayload): Promise<Room> => {
  const { data } = await api.post<ApiRoom>('/rooms', {
    ...payload,
    category: payload.category.toUpperCase(),
  });
  return normalizeRoom(data);
};

export const updateRoom = async (id: string, payload: Partial<RoomPayload>): Promise<Room> => {
  const { data } = await api.patch<ApiRoom>(`/rooms/${id}`, {
    ...payload,
    ...(payload.category ? { category: payload.category.toUpperCase() } : {}),
  });
  return normalizeRoom(data);
};
