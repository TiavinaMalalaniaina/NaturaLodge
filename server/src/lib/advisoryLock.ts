import { Prisma } from '@prisma/client';

// Clés arbitraires mais fixes, une par séquence à protéger.
export const LOCK_KEYS = {
  invoiceNumber:      7_301_001,
  journalEntryNumber: 7_301_002,
} as const;

// Les numéros de séquence (factures, écritures) sont calculés à partir des lignes existantes : sans
// sérialisation, deux transactions concurrentes lisent le même état, calculent le même numéro et
// l'une échoue sur la contrainte d'unicité. Ce verrou est relâché automatiquement au commit/rollback,
// il DOIT donc être pris dans une transaction (sinon il est relâché aussitôt et ne protège rien).
// Ordre de prise toujours invoiceNumber puis journalEntryNumber (visa → écriture) : pas d'interblocage.
export async function lockForTransaction(tx: Prisma.TransactionClient, key: number): Promise<void> {
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${key})`);
}
