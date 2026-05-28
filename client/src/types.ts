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
  author: string;
  role: string;
  date: string;
  content: string;
}

export type StaffRole = 'admin' | 'manager' | 'receptionist' | 'housekeeping';

export interface StaffMember {
  id: string;
  name: string;
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

export interface Room {
  id: string;
  number: string;
  type: string;
  category: 'Superior' | 'Deluxe' | 'Suite' | 'Penthouse' | 'Villa' | 'Luxury';
  area: number;
  bedType: string;
  capacity: string;
  rate: number;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  view: string;
  images: string[];
  description: string;
  features: string[]; // Array of feature IDs
}

export interface Booking {
  id: string;
  guestId: string;
  guestName: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  arrival: string;
  departure: string;
  status: 'confirmed' | 'checked-in' | 'checked-out' | 'awaiting' | 'cancelled';
  totalAmount: number;
}
