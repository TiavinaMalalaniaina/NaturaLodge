import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRoles, createRole, updateRole, UpdateRolePayload } from '../api/roles';
import { PERMISSIONS_KEY } from './usePermissions';
import { STAFF_KEY } from './useStaff';

export const ROLES_KEY = ['roles'] as const;

export function useRoles() {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn:  fetchRoles,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ROLES_KEY });
      qc.invalidateQueries({ queryKey: PERMISSIONS_KEY });
    },
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRolePayload }) => updateRole(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ROLES_KEY });
      qc.invalidateQueries({ queryKey: PERMISSIONS_KEY });
      qc.invalidateQueries({ queryKey: STAFF_KEY }); // le nom du rôle affiché sur l'annuaire staff change
    },
  });
}
