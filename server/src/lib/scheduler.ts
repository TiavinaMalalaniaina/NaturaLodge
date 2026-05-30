import { prisma } from './prisma';

async function markArrivalsOccupied(): Promise<void> {
  const now   = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end   = new Date(now); end.setHours(23, 59, 59, 999);

  const arrivingToday = await prisma.bookingRoom.findMany({
    where: {
      arrival: { gte: start, lte: end },
      booking: { status: { notIn: ['CANCELLED', 'CHECKED_OUT'] } },
      room:    { status: { not: 'MAINTENANCE' } },
    },
    select: { roomId: true },
  });

  const roomIds = [...new Set(arrivingToday.map(br => br.roomId))];
  if (roomIds.length === 0) return;

  await prisma.room.updateMany({
    where: { id: { in: roomIds } },
    data:  { status: 'OCCUPIED' },
  });

  console.log(`[Scheduler] ${roomIds.length} chambre(s) passée(s) à OCCUPIED pour les arrivées du jour`);
}

function msUntilMidnight(): number {
  const now      = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 1, 0, 0); // 00:01 pour être sûr
  return midnight.getTime() - now.getTime();
}

export function startScheduler(): void {
  // Exécution immédiate au démarrage du serveur (rattraper les arrivées du jour si redémarrage)
  markArrivalsOccupied().catch(console.error);

  function scheduleNext() {
    setTimeout(() => {
      markArrivalsOccupied().catch(console.error);
      scheduleNext();
    }, msUntilMidnight());
  }
  scheduleNext();

  console.log('[Scheduler] Démarré — arrivées du jour traitées à 00:01 chaque nuit');
}
