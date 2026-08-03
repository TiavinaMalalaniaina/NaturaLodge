import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchExtras, fetchExtra, createExtra, updateExtra, deleteExtra, ExtraPayload } from '../api/extras';

export const EXTRAS_KEY = ['extras'] as const;

export function useExtras() {
  return useQuery({ queryKey: EXTRAS_KEY, queryFn: fetchExtras, staleTime: 60_000 });
}

export function useExtra(id: string) {
  return useQuery({
    queryKey: [...EXTRAS_KEY, id],
    queryFn:  () => fetchExtra(id),
    enabled:  !!id,
  });
}

export function useCreateExtra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createExtra,
    onSuccess:  () => qc.invalidateQueries({ queryKey: EXTRAS_KEY }),
  });
}

export function useUpdateExtra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Partial<ExtraPayload>) => updateExtra(id, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: EXTRAS_KEY }),
  });
}

export function useDeleteExtra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteExtra,
    onSuccess:  () => qc.invalidateQueries({ queryKey: EXTRAS_KEY }),
  });
}
