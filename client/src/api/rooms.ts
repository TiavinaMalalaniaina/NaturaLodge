import { api } from './client';
import { Room, RoomFeature } from '../types';

// ─── Raw API shape (flattened by server) ─────────────────────────

interface ApiRoom {
  id: string; number: string; status: string;
  images: string[]; rateOverride: number | null; roomTypeId: string;
  type: string; rate: number;
  description: string; area: number; bedType: string;
  capacity: number; view: string;
  features: { id: string; label: string; iconName: string }[];
}

const STATUS_MAP: Record<string, Room['status']> = {
  AVAILABLE: 'available', OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance', RESERVED: 'reserved',
};

export function normalizeRoom(r: ApiRoom): Room {
  return {
    id:           r.id,
    number:       r.number,
    roomTypeId:   r.roomTypeId,
    type:         r.type,
    rate:         r.rate,
    rateOverride: r.rateOverride,
    status:       STATUS_MAP[r.status] ?? 'available',
    area:         r.area,
    bedType:      r.bedType,
    capacity:     r.capacity,
    view:         r.view ?? '',
    images:       r.images,
    description:  r.description ?? '',
    features:     r.features.map(f => f.id),
  };
}

// ─── Conflict bookings (maintenance) ─────────────────────────────

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

// ─── Params & fetchers ────────────────────────────────────────────

export interface RoomsParams {
  search?: string;
  status?: string;
}

export const fetchRooms = async (params?: RoomsParams): Promise<Room[]> => {
  const { data } = await api.get<ApiRoom[]>('/rooms', { params });
  return data.map(normalizeRoom);
};

export const fetchRoom = async (id: string): Promise<Room> => {
  const { data } = await api.get<ApiRoom>(`/rooms/${id}`);
  return normalizeRoom(data);
};

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

export const fetchRoomFeatures = async (): Promise<RoomFeature[]> => {
  const { data } = await api.get<RoomFeature[]>('/rooms/features');
  return data;
};

export const createRoomFeature = async (payload: { label: string; iconName: string }): Promise<RoomFeature> => {
  const { data } = await api.post<RoomFeature>('/rooms/features', payload);
  return data;
};

export const deleteRoomFeature = async (id: string): Promise<void> => {
  await api.delete(`/rooms/features/${id}`);
};

// ─── Room CRUD ────────────────────────────────────────────────────

export interface RoomPayload {
  number:       string;
  roomTypeId:   string;
  images?:      string[];
  rateOverride?: number | null;
}

export const createRoom = async (payload: RoomPayload): Promise<Room> => {
  const { data } = await api.post<ApiRoom>('/rooms', payload);
  return normalizeRoom(data);
};

export const updateRoom = async (id: string, payload: Partial<RoomPayload>): Promise<Room> => {
  const { data } = await api.patch<ApiRoom>(`/rooms/${id}`, payload);
  return normalizeRoom(data);
};
