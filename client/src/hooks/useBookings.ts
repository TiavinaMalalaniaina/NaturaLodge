import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchBooking, fetchBookings, createBooking, updateBookingStatus, reassignRoom, BookingParams } from '../api/bookings';
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
    mutationFn: ({ bookingId, oldRoomId, newRoomId }: { bookingId: string; oldRoomId: string; newRoomId: string }) =>
      reassignRoom(bookingId, oldRoomId, newRoomId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
      qc.invalidateQueries({ queryKey: ROOMS_KEY });
    },
  });
}

export function useTodayArrivals() {
  const today = new Date().toISOString().split('T')[0];
  return useQuery({
    queryKey: [...BOOKINGS_KEY, 'arrivals', today],
    queryFn: () => fetchBookings({ date: today, status: 'CONFIRMED', limit: 100 }),
  });
}
