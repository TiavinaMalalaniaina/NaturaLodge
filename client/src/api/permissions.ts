import { api } from './client';
import { UserRole } from '../context/AuthContext';

export interface PermissionEntry {
  id:          string;
  key:         string;
  domain:      string;
  description: string;
  roles:       UserRole[];
}

export const fetchPermissions = async (): Promise<PermissionEntry[]> => {
  const { data } = await api.get<PermissionEntry[]>('/permissions');
  return data;
};

export interface UpdatePermissionPayload {
  permissionId: string;
  role:         UserRole;
  granted:      boolean;
}

export const updateRolePermission = async (payload: UpdatePermissionPayload): Promise<void> => {
  await api.patch('/permissions', payload);
};
