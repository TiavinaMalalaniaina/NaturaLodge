import jwt from 'jsonwebtoken';
import { BookingStatus, InvoiceStatus } from '@prisma/client';
import { prisma } from './db';

let seq = 0;
const next = () => ++seq;

export type RoleName = 'ADMIN' | 'MANAGER' | 'GERANT' | 'HOUSEKEEPING';

// Séjours stockés à minuit UTC, comme le fait l'application.
export function day(offsetFromToday: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetFromToday));
}

export async function createStaff(role: RoleName = 'ADMIN') {
  const n = next();
  const dbRole = await prisma.role.findUniqueOrThrow({ where: { name: role } });
  const user = await prisma.user.create({
    data: { username: `${role.toLowerCase()}${n}`, password: 'not-a-real-hash', name: `${role} ${n}`, roleId: dbRole.id },
  });
  // Même charge utile que auth.service.ts (login) : le middleware ne fait que vérifier la signature.
  const token = jwt.sign({ id: user.id, username: user.username, role }, process.env.JWT_SECRET!, { expiresIn: '1h' });
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

export async function createGuest(name = `Client ${next()}`) {
  return prisma.guest.create({ data: { name } });
}

export async function createRoom(options: { status?: 'AVAILABLE' | 'MAINTENANCE'; rate?: number } = {}) {
  const n = next();
  const roomType = await prisma.roomType.create({ data: { name: `Type ${n}`, rate: options.rate ?? 100_000 } });
  return prisma.room.create({ data: { number: `T${n}`, roomTypeId: roomType.id, status: options.status ?? 'AVAILABLE' } });
}

// Corps de POST /api/bookings — dates au format ISO attendu par booking.schema.ts.
export function bookingBody(guestId: string, roomIds: string[], arrival: Date, departure: Date, status: 'CONFIRMED' | 'AWAITING' = 'CONFIRMED') {
  const nights = Math.round((departure.getTime() - arrival.getTime()) / 86_400_000);
  return {
    guestId,
    arrival: arrival.toISOString(),
    departure: departure.toISOString(),
    status,
    rooms: roomIds.map(roomId => ({ roomId, roomRate: 100_000 })),
    totalAmount: 100_000 * nights * roomIds.length,
  };
}

// Insertion directe, sans passer par les règles du service : pour mettre une réservation dans un
// état de départ précis (ex. déjà check-outée) sans rejouer tout le parcours.
export async function insertBooking(status: BookingStatus, options: { arrival?: Date; departure?: Date; guestName?: string } = {}) {
  const guest = await createGuest(options.guestName);
  const room = await createRoom();
  const arrival = options.arrival ?? day(1);
  const departure = options.departure ?? day(3);
  const booking = await prisma.booking.create({
    data: {
      guestId: guest.id, status, arrival, departure, totalAmount: 200_000,
      rooms: { create: [{ roomId: room.id, roomRate: 100_000, arrival, departure }] },
    },
  });
  return { booking, guest, room };
}

// Facture STANDARD minimale : seul son statut compte pour computePaymentStatus (booking.service.ts).
export async function insertInvoice(bookingId: string, guestId: string, status: InvoiceStatus) {
  return prisma.invoice.create({ data: { bookingId, guestId, status, totalAmount: 200_000, kind: 'STANDARD' } });
}
