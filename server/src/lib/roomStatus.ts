import { Prisma, RoomStatus } from '@prisma/client';
import { prisma } from './prisma';

type PrismaOrTx = Prisma.TransactionClient | typeof prisma;

/**
 * Calcule le statut réel de chaque chambre en interrogeant les réservations actives.
 * OCCUPIED  = une réservation est en cours (arrival <= now <= departure, non annulée/terminée)
 *             OU un client est CHECKED_IN sans avoir été checkouté (overstay/en retard —
 *             la chambre reste occupée même après la date de départ prévue tant que le
 *             checkout n'a pas été fait explicitement).
 * AVAILABLE = aucune réservation active
 * MAINTENANCE n'est jamais retourné ici — il est géré manuellement en base.
 */
export async function computeRoomStatuses(roomIds: string[], client: PrismaOrTx = prisma): Promise<Map<string, RoomStatus>> {
  if (roomIds.length === 0) return new Map();

  const now = new Date();

  const active = await client.bookingRoom.findMany({
    where: {
      roomId:  { in: roomIds },
      arrival: { lte: now },
      booking: { status: { notIn: ['CANCELLED', 'CHECKED_OUT'] } },
      OR: [
        { departure: { gte: now } },
        { booking: { status: 'CHECKED_IN' } },
      ],
    },
    select: { roomId: true },
  });

  const occupiedIds = new Set(active.map(br => br.roomId));
  const result      = new Map<string, RoomStatus>();

  for (const id of roomIds) {
    result.set(id, occupiedIds.has(id) ? 'OCCUPIED' : 'AVAILABLE');
  }
  return result;
}

/**
 * Applique les statuts calculés en base, sans jamais écraser MAINTENANCE.
 */
export async function applyRoomStatuses(roomIds: string[], client: PrismaOrTx = prisma): Promise<void> {
  const computed    = await computeRoomStatuses(roomIds, client);
  const occupiedIds = [...computed.entries()].filter(([, s]) => s === 'OCCUPIED') .map(([id]) => id);
  const availableIds= [...computed.entries()].filter(([, s]) => s === 'AVAILABLE').map(([id]) => id);

  await Promise.all([
    occupiedIds.length  && client.room.updateMany({ where: { id: { in: occupiedIds  }, status: { not: 'MAINTENANCE' } }, data: { status: 'OCCUPIED'  } }),
    availableIds.length && client.room.updateMany({ where: { id: { in: availableIds }, status: { not: 'MAINTENANCE' } }, data: { status: 'AVAILABLE' } }),
  ]);
}
