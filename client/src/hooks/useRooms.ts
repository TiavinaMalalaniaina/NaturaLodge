import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchRooms, fetchRoom, fetchAvailableRooms, createRoom, updateRoom,
  fetchRoomFeatures, createRoomFeature, deleteRoomFeature,
  setRoomStatus,
  RoomPayload, RoomsParams, // RoomPayload now only has number/roomTypeId/images/rateOverride
} from '../api/rooms';
import { ROOM_TYPES_KEY } from './useRoomTypes';

export const ROOMS_KEY     = ['rooms'] as const;
export const FEATURES_KEY  = [...ROOMS_KEY, 'features'] as const;

export function useRooms(params?: RoomsParams, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: params ? [...ROOMS_KEY, params] : ROOMS_KEY,
    queryFn:  () => fetchRooms(params),
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function useRoom(id: string) {
  return useQuery({ queryKey: [...ROOMS_KEY, id], queryFn: () => fetchRoom(id), enabled: !!id });
}

export function useAvailableRooms(arrival: string, departure: string, excludeBookingId?: string) {
  return useQuery({
    queryKey: [...ROOMS_KEY, 'available', arrival, departure, excludeBookingId],
    queryFn: () => fetchAvailableRooms(arrival, departure, excludeBookingId),
    enabled: !!arrival && !!departure && departure > arrival,
    staleTime: 0, // toujours frais — les dispos changent souvent
  });
}

export function useRoomFeatures() {
  return useQuery({ queryKey: FEATURES_KEY, queryFn: fetchRoomFeatures });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RoomPayload) => createRoom(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROOMS_KEY }),
  });
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Partial<RoomPayload>) => updateRoom(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROOMS_KEY }),
  });
}

export function useUpdateRoomStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => setRoomStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROOMS_KEY }),
  });
}

// Les features sont rattachées aux types de chambre — toute mutation doit aussi
// invalider les types de chambre (et les chambres, qui affichent leurs features) en cache.
export function useCreateRoomFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRoomFeature,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FEATURES_KEY });
      qc.invalidateQueries({ queryKey: ROOM_TYPES_KEY });
      qc.invalidateQueries({ queryKey: ROOMS_KEY });
    },
  });
}

export function useDeleteRoomFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRoomFeature,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FEATURES_KEY });
      qc.invalidateQueries({ queryKey: ROOM_TYPES_KEY });
      qc.invalidateQueries({ queryKey: ROOMS_KEY });
    },
  });
}
