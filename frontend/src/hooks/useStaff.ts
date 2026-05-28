import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchStaff } from '../api/staff';
import { api } from '../api/client';

export const STAFF_KEY = ['staff'] as const;

export function useStaff() {
  return useQuery({ queryKey: STAFF_KEY, queryFn: fetchStaff });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/staff/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: STAFF_KEY }),
  });
}
