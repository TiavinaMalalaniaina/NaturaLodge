import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchBooking, fetchBookings, createBooking, updateBookingStatus, reassignRoom, addBookingRoom, removeBookingRoom, BookingParams } from '../api/bookings';
import { ROOMS_KEY } from './useRooms';

export const BOOKINGS_KEY = ['bookings'] as const;

export function useBooking(id: string) {
  return useQuery({
    queryKey: [...BOOKINGS_KEY, id],
    queryFn:  () => fetchBooking(id),
    enabled:  !!id,
  });
}

export function useBookings(params?: BookingParams) {
  return useQuery({
    queryKey: params ? [...BOOKINGS_KEY, params] : BOOKINGS_KEY,
    queryFn: () => fetchBookings(params),
    placeholderData: (prev) => prev,
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
      qc.invalidateQueries({ queryKey: ROOMS_KEY });
    },
  });
}

export function useUpdateBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateBookingStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
      qc.invalidateQueries({ queryKey: ROOMS_KEY });
    },
  });
}

export function useReassignRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, oldRoomId, newRoomId, arrival, departure, roomRate }: {
      bookingId: string; oldRoomId: string; newRoomId: string; arrival?: string; departure?: string; roomRate?: number;
    }) => reassignRoom(bookingId, oldRoomId, newRoomId, arrival, departure, roomRate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
      qc.invalidateQueries({ queryKey: ROOMS_KEY });
    },
  });
}

export function useAddBookingRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, ...payload }: {
      bookingId: string; roomId: string; arrival?: string; departure?: string; roomRate?: number;
    }) => addBookingRoom(bookingId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
      qc.invalidateQueries({ queryKey: ROOMS_KEY });
    },
  });
}

export function useRemoveBookingRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, roomId }: { bookingId: string; roomId: string }) =>
      removeBookingRoom(bookingId, roomId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
      qc.invalidateQueries({ queryKey: ROOMS_KEY });
    },
  });
}
