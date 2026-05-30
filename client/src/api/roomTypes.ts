import { api } from './client';
import { RoomType, RoomFeature, RoomCategory } from '../types';

const CATEGORY_MAP: Record<string, RoomCategory> = {
  SUPERIOR: 'Superior', DELUXE: 'Deluxe', SUITE: 'Suite',
  PENTHOUSE: 'Penthouse', VILLA: 'Villa', LUXURY: 'Luxury',
};

interface ApiRoomType {
  id: string; name: string; category: string; rate: number;
  description: string; area: number; bedType: string;
  capacity: number; view: string;
  features: RoomFeature[];
  rooms: { id: string }[];
}

function normalizeRoomType(rt: ApiRoomType): RoomType {
  return {
    ...rt,
    category: CATEGORY_MAP[rt.category] ?? (rt.category as RoomCategory),
  };
}

export const fetchRoomTypes = async (): Promise<RoomType[]> => {
  const { data } = await api.get<ApiRoomType[]>('/room-types');
  return data.map(normalizeRoomType);
};

export const fetchRoomType = async (id: string): Promise<RoomType> => {
  const { data } = await api.get<ApiRoomType>(`/room-types/${id}`);
  return normalizeRoomType(data);
};

export interface RoomTypePayload {
  name:        string;
  category:    string;
  rate:        number;
  description?: string;
  area?:        number;
  bedType?:     string;
  capacity?:    number;
  view?:        string;
  featureIds?:  string[];
}

export const createRoomType = async (payload: RoomTypePayload): Promise<RoomType> => {
  const { data } = await api.post<ApiRoomType>('/room-types', {
    ...payload,
    category: payload.category.toUpperCase(),
  });
  return normalizeRoomType(data);
};

export const updateRoomType = async (id: string, payload: Partial<RoomTypePayload>): Promise<RoomType> => {
  const { data } = await api.patch<ApiRoomType>(`/room-types/${id}`, {
    ...payload,
    ...(payload.category ? { category: payload.category.toUpperCase() } : {}),
  });
  return normalizeRoomType(data);
};

export const deleteRoomType = async (id: string): Promise<void> => {
  await api.delete(`/room-types/${id}`);
};
