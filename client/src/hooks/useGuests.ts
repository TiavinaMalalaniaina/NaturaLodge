import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchGuests, fetchGuest, createGuest, updateGuest, GuestParams } from '../api/guests';
import { api } from '../api/client';

export const GUESTS_KEY = ['guests'] as const;

export function useGuests(params?: GuestParams) {
  return useQuery({
    queryKey:     params ? [...GUESTS_KEY, params] : GUESTS_KEY,
    queryFn:      () => fetchGuests(params),
    placeholderData: (prev) => prev,
  });
}

export function useGuest(id: string) {
  return useQuery({
    queryKey: [...GUESTS_KEY, id],
    queryFn:  () => fetchGuest(id),
    enabled:  !!id,
  });
}

export function useCreateGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createGuest,
    onSuccess:  () => qc.invalidateQueries({ queryKey: GUESTS_KEY }),
  });
}

export function useUpdateGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateGuest>[1]) =>
      updateGuest(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: GUESTS_KEY });
      qc.invalidateQueries({ queryKey: [...GUESTS_KEY, id] });
    },
  });
}

export function useAddGuestNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ guestId, content }: { guestId: string; content: string }) =>
      api.post(`/guests/${guestId}/notes`, { content }),
    onSuccess: (_data, { guestId }) =>
      qc.invalidateQueries({ queryKey: [...GUESTS_KEY, guestId] }),
  });
}
