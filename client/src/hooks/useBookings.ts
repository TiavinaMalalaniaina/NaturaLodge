import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBooking, fetchBookings, createBooking, updateBookingStatus, closeBooking, reassignRoom,
  addBookingRoom, removeBookingRoom, addBookingRoomExtra, updateBookingRoomExtra, removeBookingRoomExtra,
  BookingParams,
  addBookingNote,
} from '../api/bookings';
import { ROOMS_KEY } from './useRooms';
import { INVOICES_KEY } from './useInvoices';

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

export function useCloseBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => closeBooking(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
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
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
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
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
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
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
    },
  });
}

export function useAddBookingRoomExtra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, roomId, extraId, quantity }: {
      bookingId: string; roomId: string; extraId: string; quantity?: number;
    }) => addBookingRoomExtra(bookingId, roomId, { extraId, quantity }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
    },
  });
}

export function useUpdateBookingRoomExtra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, roomId, extraId, quantity }: {
      bookingId: string; roomId: string; extraId: string; quantity: number;
    }) => updateBookingRoomExtra(bookingId, roomId, extraId, quantity),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
    },
  });
}

export function useRemoveBookingRoomExtra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, roomId, extraId }: { bookingId: string; roomId: string; extraId: string }) =>
      removeBookingRoomExtra(bookingId, roomId, extraId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOKINGS_KEY });
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
    },
  });
}

export function useAddBookingNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, content }: { bookingId: string; content: string }) =>
      addBookingNote(bookingId, content),
    onSuccess: (_data, { bookingId }) =>
      qc.invalidateQueries({ queryKey: [...BOOKINGS_KEY, bookingId] }),
  });
}
