import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchBookings, createBooking, updateBookingStatus, BookingParams } from '../api/bookings';

export const BOOKINGS_KEY = ['bookings'] as const;

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
    onSuccess: () => qc.invalidateQueries({ queryKey: BOOKINGS_KEY }),
  });
}

export function useUpdateBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateBookingStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: BOOKINGS_KEY }),
  });
}

export function useTodayArrivals() {
  const today = new Date().toISOString().split('T')[0];
  return useQuery({
    queryKey: [...BOOKINGS_KEY, 'arrivals', today],
    queryFn: () => fetchBookings({ date: today, status: 'CONFIRMED', limit: 100 }),
  });
}
