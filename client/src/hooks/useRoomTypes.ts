import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchRoomTypes, fetchRoomType,
  createRoomType, updateRoomType, deleteRoomType,
  RoomTypePayload,
} from '../api/roomTypes';

export const ROOM_TYPES_KEY = ['room-types'] as const;

export function useRoomTypes() {
  return useQuery({
    queryKey: ROOM_TYPES_KEY,
    queryFn:  fetchRoomTypes,
    staleTime: 60_000,
  });
}

export function useRoomType(id: string) {
  return useQuery({
    queryKey: [...ROOM_TYPES_KEY, id],
    queryFn:  () => fetchRoomType(id),
    enabled:  !!id,
  });
}

export function useCreateRoomType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRoomType,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ROOM_TYPES_KEY }),
  });
}

export function useUpdateRoomType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Partial<RoomTypePayload>) =>
      updateRoomType(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROOM_TYPES_KEY }),
  });
}

export function useDeleteRoomType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRoomType,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ROOM_TYPES_KEY }),
  });
}
