import { Prisma, RoomStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { applyRoomStatuses } from '../lib/roomStatus';
import { NotFoundError } from '../errors/AppError';
import { RoomInput, RoomFeatureInput } from '../validation/room.schema';

const roomInclude = {
  roomType: { include: { features: true } },
} as const;

type RoomWithType = Prisma.RoomGetPayload<{ include: typeof roomInclude }>;

function flattenRoom(r: RoomWithType) {
  const rt = r.roomType;
  return {
    id:           r.id,
    number:       r.number,
    status:       r.status,
    images:       r.images,
    rateOverride: r.rateOverride ?? null,
    roomTypeId:   r.roomTypeId,
    createdAt:    r.createdAt,
    // Flattened from RoomType
    type:         rt.name,
    rate:         r.rateOverride ?? rt.rate,
    description:  rt.description,
    area:         rt.area,
    bedType:      rt.bedType,
    capacity:     rt.capacity,
    view:         rt.view,
    features:     rt.features,
  };
}

export function listFeatures() {
  return prisma.roomFeature.findMany({ orderBy: { label: 'asc' } });
}

export function createFeature(data: RoomFeatureInput) {
  return prisma.roomFeature.create({ data });
}

export async function removeFeature(id: string): Promise<void> {
  await prisma.roomFeature.delete({ where: { id } });
}

export async function listAvailable(arrival: Date, departure: Date, excludeBookingId?: string) {
  const rooms = await prisma.room.findMany({
    where: {
      status: { not: 'MAINTENANCE' },
      bookings: {
        none: {
          arrival:  { lt: departure },
          departure: { gt: arrival },
          booking:  {
            status: { notIn: ['CANCELLED', 'CHECKED_OUT'] },
            ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
          },
        },
      },
    },
    include: roomInclude,
    orderBy: { number: 'asc' },
  });

  return rooms.map(flattenRoom);
}

export async function list(search?: string, status?: string) {
  const rooms = await prisma.room.findMany({
    where: {
      ...(search ? {
        OR: [
          { number:   { contains: search, mode: 'insensitive' } },
          { roomType: { name: { contains: search, mode: 'insensitive' } } },
        ],
      } : {}),
      ...(status && status !== 'ALL' ? { status: status as RoomStatus } : {}),
    },
    include: roomInclude,
    orderBy: { number: 'asc' },
  });

  return rooms.map(flattenRoom);
}

export async function getById(id: string) {
  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      roomType: { include: { features: true } },
      bookings: {
        include: {
          booking: {
            include: { guest: { select: { id: true, name: true, email: true, avatar: true } } },
          },
        },
        orderBy: { arrival: 'desc' },
        take: 10,
      },
    },
  });
  if (!room) throw new NotFoundError('Chambre');
  return { ...flattenRoom(room), bookings: room.bookings };
}

export async function create(data: RoomInput) {
  const room = await prisma.room.create({
    data: {
      number:       data.number,
      roomTypeId:   data.roomTypeId,
      images:       data.images ?? [],
      rateOverride: data.rateOverride ?? null,
    },
    include: roomInclude,
  });
  return flattenRoom(room);
}

export async function update(id: string, data: Partial<RoomInput>) {
  const room = await prisma.room.update({
    where: { id },
    data: {
      ...(data.number       !== undefined && { number:       data.number }),
      ...(data.roomTypeId   !== undefined && { roomTypeId:   data.roomTypeId }),
      ...(data.images       !== undefined && { images:       data.images }),
      ...(data.rateOverride !== undefined && { rateOverride: data.rateOverride }),
      ...(data.status       !== undefined && { status:       data.status }),
    },
    include: roomInclude,
  });

  // Si passage en maintenance, renvoyer les réservations actives/futures impactées
  if (data.status === 'MAINTENANCE') {
    const conflicts = await prisma.booking.findMany({
      where: {
        rooms:     { some: { roomId: room.id } },
        status:    { notIn: ['CANCELLED', 'CHECKED_OUT'] },
        departure: { gte: new Date() },
      },
      select: {
        id:       true,
        arrival:  true,
        departure: true,
        guest:    { select: { name: true } },
      },
      orderBy: { arrival: 'asc' },
    });
    return { ...flattenRoom(room), conflicts };
  }

  // Si passage hors maintenance (AVAILABLE), recalculer le vrai statut
  if (data.status === 'AVAILABLE') {
    await applyRoomStatuses([room.id]);
    const refreshed = await prisma.room.findUnique({ where: { id: room.id }, include: roomInclude });
    return flattenRoom(refreshed!);
  }

  return flattenRoom(room);
}

export async function remove(id: string): Promise<void> {
  await prisma.room.delete({ where: { id } });
}
