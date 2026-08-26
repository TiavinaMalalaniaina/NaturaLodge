import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPermissions, updateRolePermission } from '../api/permissions';

export const PERMISSIONS_KEY = ['permissions'] as const;

export function usePermissions() {
  return useQuery({
    queryKey: PERMISSIONS_KEY,
    queryFn:  fetchPermissions,
  });
}

export function useUpdateRolePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateRolePermission,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PERMISSIONS_KEY });
    },
  });
}
