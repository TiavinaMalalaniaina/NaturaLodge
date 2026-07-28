import { api } from './client';
import { StaffMember, StaffRole } from '../types';
import { formatRelativeTime } from '../lib/relativeTime';

interface ApiStaff {
  id: string; email: string; name: string;
  role: string; status: string; avatar?: string;
  joinedDate: string; lastLogin?: string;
}

const ROLE_MAP: Record<string, StaffRole> = {
  ADMIN: 'admin', MANAGER: 'manager',
  RECEPTIONIST: 'receptionist', HOUSEKEEPING: 'housekeeping',
};

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
    email: s.email,
    role: ROLE_MAP[s.role] ?? 'receptionist',
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

const ROLE_TO_API: Record<StaffRole, string> = {
  admin: 'ADMIN', manager: 'MANAGER',
  receptionist: 'RECEPTIONIST', housekeeping: 'HOUSEKEEPING',
};

export interface CreateStaffPayload {
  name:     string;
  email:    string;
  password: string;
  role:     StaffRole;
}

export const createStaff = async (payload: CreateStaffPayload): Promise<StaffMember> => {
  const { data } = await api.post<ApiStaff>('/staff', {
    name:     payload.name,
    email:    payload.email,
    password: payload.password,
    role:     ROLE_TO_API[payload.role],
  });
  return normalizeStaff(data);
};

const STATUS_TO_API: Record<StaffMember['status'], string> = {
  active: 'ACTIVE', 'on-leave': 'ON_LEAVE', inactive: 'INACTIVE',
};

export interface UpdateStaffPayload {
  name?:   string;
  email?:  string;
  role?:   StaffRole;
  status?: StaffMember['status'];
}

export const updateStaff = async (id: string, payload: UpdateStaffPayload): Promise<StaffMember> => {
  const { data } = await api.patch<ApiStaff>(`/staff/${id}`, {
    ...(payload.name   !== undefined && { name: payload.name }),
    ...(payload.email  !== undefined && { email: payload.email }),
    ...(payload.role   !== undefined && { role: ROLE_TO_API[payload.role] }),
    ...(payload.status !== undefined && { status: STATUS_TO_API[payload.status] }),
  });
  return normalizeStaff(data);
};
