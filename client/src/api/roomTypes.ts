import { api } from './client';
import { RoomType, RoomFeature } from '../types';

interface ApiRoomType {
  id: string; name: string; rate: number;
  description: string; area: number; bedType: string;
  capacity: number; view: string;
  features: RoomFeature[];
  rooms: { id: string }[];
}

export const fetchRoomTypes = async (): Promise<RoomType[]> => {
  const { data } = await api.get<ApiRoomType[]>('/room-types');
  return data;
};

export const fetchRoomType = async (id: string): Promise<RoomType> => {
  const { data } = await api.get<ApiRoomType>(`/room-types/${id}`);
  return data;
};

export interface RoomTypePayload {
  name:        string;
  rate:        number;
  description?: string;
  area?:        number;
  bedType?:     string;
  capacity?:    number;
  view?:        string;
  featureIds?:  string[];
}

export const createRoomType = async (payload: RoomTypePayload): Promise<RoomType> => {
  const { data } = await api.post<ApiRoomType>('/room-types', payload);
  return data;
};

export const updateRoomType = async (id: string, payload: Partial<RoomTypePayload>): Promise<RoomType> => {
  const { data } = await api.patch<ApiRoomType>(`/room-types/${id}`, payload);
  return data;
};

export const deleteRoomType = async (id: string): Promise<void> => {
  await api.delete(`/room-types/${id}`);
};
