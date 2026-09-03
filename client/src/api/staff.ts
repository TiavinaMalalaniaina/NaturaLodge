import { api } from './client';
import { StaffMember } from '../types';
import { formatRelativeTime } from '../lib/relativeTime';

interface ApiStaff {
  id: string; username: string; email: string | null; name: string;
  role: { id: string; name: string }; status: string; avatar?: string;
  joinedDate: string; lastLogin?: string;
}

const STATUS_MAP: Record<string, StaffMember['status']> = {
  ACTIVE: 'active', ON_LEAVE: 'on-leave', INACTIVE: 'inactive',
};

export function normalizeStaff(s: ApiStaff): StaffMember {
  const lastLogin = s.lastLogin
    ? formatRelativeTime(new Date(s.lastLogin))
    : 'Jamais';
  return {
    id: s.id,
    name: s.name,
    username: s.username,
    email: s.email ?? '',
    role: s.role.name,
    roleId: s.role.id,
    status: STATUS_MAP[s.status] ?? 'active',
    avatar: s.avatar,
    joinedDate: new Date(s.joinedDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
    lastLogin,
  };
}

export const fetchStaff = async (): Promise<StaffMember[]> => {
  const { data } = await api.get<ApiStaff[]>('/staff');
  return data.map(normalizeStaff);
};

export interface CreateStaffPayload {
  name:     string;
  username: string;
  email?:   string;
  password: string;
  roleId:   string;
}

export const createStaff = async (payload: CreateStaffPayload): Promise<StaffMember> => {
  const { data } = await api.post<ApiStaff>('/staff', {
    name:     payload.name,
    username: payload.username,
    ...(payload.email ? { email: payload.email } : {}),
    password: payload.password,
    roleId:   payload.roleId,
  });
  return normalizeStaff(data);
};

const STATUS_TO_API: Record<StaffMember['status'], string> = {
  active: 'ACTIVE', 'on-leave': 'ON_LEAVE', inactive: 'INACTIVE',
};

export interface UpdateStaffPayload {
  name?:   string;
  email?:  string;
  roleId?: string;
  status?: StaffMember['status'];
}

export const updateStaff = async (id: string, payload: UpdateStaffPayload): Promise<StaffMember> => {
  const { data } = await api.patch<ApiStaff>(`/staff/${id}`, {
    ...(payload.name   !== undefined && { name: payload.name }),
    ...(payload.email  !== undefined && { email: payload.email }),
    ...(payload.roleId !== undefined && { roleId: payload.roleId }),
    ...(payload.status !== undefined && { status: STATUS_TO_API[payload.status] }),
  });
  return normalizeStaff(data);
};
