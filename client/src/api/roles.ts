import { api } from './client';

export interface RoleSummary {
  id:        string;
  name:      string;
  isSystem:  boolean;
  userCount: number;
}

export const fetchRoles = async (): Promise<RoleSummary[]> => {
  const { data } = await api.get<RoleSummary[]>('/roles');
  return data;
};

export interface CreateRolePayload {
  name: string;
}

export const createRole = async (payload: CreateRolePayload): Promise<RoleSummary> => {
  const { data } = await api.post<RoleSummary>('/roles', payload);
  return data;
};

export interface UpdateRolePayload {
  name: string;
}

export const updateRole = async (id: string, payload: UpdateRolePayload): Promise<RoleSummary> => {
  const { data } = await api.patch<RoleSummary>(`/roles/${id}`, payload);
  return data;
};
