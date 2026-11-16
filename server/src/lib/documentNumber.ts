import { Prisma } from '@prisma/client';
import { lockForTransaction } from './advisoryLock';

type NumberedTable = 'Invoice' | 'JournalEntry';

// Année de l'hôtel (Madagascar), pas celle du serveur (UTC en conteneur) : le 31 décembre à 22h
// heure locale appartient déjà à la nouvelle année.
function hotelYear(): number {
  return Number(new Intl.DateTimeFormat('en', { timeZone: 'Indian/Antananarivo', year: 'numeric' }).format(new Date()));
}

// Numéro `PREFIX-AAAA-NNNN`, séquence remise à 0001 chaque année. Basé sur le plus grand numéro déjà
// émis cette année pour ce préfixe (pas sur un comptage) : reste croissant même si l'historique
// contient des numéros issus de l'ancienne séquence continue.
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  table: NumberedTable,
  prefix: string,
  lockKey: number,
): Promise<string> {
  await lockForTransaction(tx, lockKey);
  const base = `${prefix}-${hotelYear()}-`;
  const rows = await tx.$queryRaw<{ max: number | null }[]>(Prisma.sql`
    SELECT MAX(CAST(split_part("number", '-', 3) AS integer))::int AS max
    FROM ${Prisma.raw(`"${table}"`)}
    WHERE "number" LIKE ${`${base}%`}`);
  return `${base}${String((rows[0]?.max ?? 0) + 1).padStart(4, '0')}`;
}
