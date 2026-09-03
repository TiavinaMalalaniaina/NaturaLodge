import { api } from './client';

export interface PermissionEntry {
  id:          string;
  key:         string;
  domain:      string;
  description: string;
  roleIds:     string[];
}

export const fetchPermissions = async (): Promise<PermissionEntry[]> => {
  const { data } = await api.get<PermissionEntry[]>('/permissions');
  return data;
};

export interface UpdatePermissionPayload {
  permissionId: string;
  roleId:       string;
  granted:      boolean;
}

export const updateRolePermission = async (payload: UpdatePermissionPayload): Promise<void> => {
  await api.patch('/permissions', payload);
};
