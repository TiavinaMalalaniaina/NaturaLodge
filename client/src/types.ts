export interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  city: string;
  status: 'VIP Elite' | 'VIP Member' | 'Platinum Tier' | 'Standard';
  lastStay: string;
  memberSince: string;
  totalStays: number;
  lifetimeValue: number;
  avatar: string;
  preferences: string[];
  notes: StaffNote[];
}

export interface StaffNote {
  id: string;
  author: { id: string; name: string; role: string };
  content: string;
  createdAt: string;
}

export interface BookingNote {
  id: string;
  author: { id: string; name: string; role: string };
  content: string;
  createdAt: string;
}

export type StaffRole = 'admin' | 'manager' | 'receptionist' | 'housekeeping';

export interface StaffMember {
  id: string;
  name: string;
  username: string;
  email: string;
  role: StaffRole;
  status: 'active' | 'on-leave' | 'inactive';
  avatar?: string;
  joinedDate: string;
  lastLogin: string;
}

export interface RoomFeature {
  id: string;
  label: string;
  iconName: string;
}

export type RoomStatus   = 'available' | 'occupied' | 'maintenance' | 'reserved';

export interface RoomType {
  id:          string;
  name:        string;
  rate:        number;
  description: string;
  area:        number;
  bedType:     string;
  capacity:    number;
  view:        string;
  features:    RoomFeature[];
  rooms:       { id: string }[];
}

export interface Room {
  id:           string;
  number:       string;
  roomTypeId:   string;
  // Flattened from RoomType for convenience
  type:         string;
  area:         number;
  bedType:      string;
  capacity:     number;
  rate:         number;        // rateOverride ?? roomType.rate
  rateOverride: number | null;
  status:       RoomStatus;
  view:         string;
  images:       string[];
  description:  string;
  features:     string[];      // feature IDs
}
