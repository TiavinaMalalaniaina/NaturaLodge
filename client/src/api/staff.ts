import { api } from './client';
import { StaffMember, StaffRole } from '../types';

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
    ? formatRelative(new Date(s.lastLogin))
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

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const fetchStaff = async (): Promise<StaffMember[]> => {
  const { data } = await api.get<ApiStaff[]>('/staff');
  return data.map(normalizeStaff);
};
