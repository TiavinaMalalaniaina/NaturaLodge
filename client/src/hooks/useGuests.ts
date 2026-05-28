import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchGuests, fetchGuest } from '../api/guests';
import { api } from '../api/client';

export const GUESTS_KEY = ['guests'] as const;

export function useGuests(search?: string) {
  return useQuery({
    queryKey: search ? [...GUESTS_KEY, search] : GUESTS_KEY,
    queryFn: () => fetchGuests(search),
  });
}

export function useGuest(id: string) {
  return useQuery({
    queryKey: [...GUESTS_KEY, id],
    queryFn: () => fetchGuest(id),
    enabled: !!id,
  });
}

export function useAddGuestNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ guestId, note }: { guestId: string; note: { author: string; role: string; content: string } }) =>
      api.post(`/guests/${guestId}/notes`, note),
    onSuccess: (_data, { guestId }) =>
      qc.invalidateQueries({ queryKey: [...GUESTS_KEY, guestId] }),
  });
}
