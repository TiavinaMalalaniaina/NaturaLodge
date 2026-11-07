import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { sendRequestMail } from './websiteMail.service';

const MAX_ATTEMPTS = 8;
// Delay before attempt n+1 (minutes): about 2 days of retries in total before giving up.
const BACKOFF_MINUTES = [1, 5, 15, 60, 180, 480, 1440];
// A claimed email that is neither sent nor released within this window is retried (process crash).
const LEASE_MINUTES = 10;

type Client = Prisma.TransactionClient | typeof prisma;

// Always call inside the transaction that changes the request status: the notification is then
// committed (or rolled back) together with the change it describes.
export async function enqueueRequestEmail(client: Client, requestId: string, status: string) {
  await client.websiteEmail.create({ data: { requestId, status } });
}

let running = false;
let again = false;

export async function processOutbox(): Promise<void> {
  if (running) { again = true; return; }
  running = true;
  try {
    do {
      again = false;
      // Claim with a lease (SKIP LOCKED) instead of holding a transaction open during the SMTP call.
      // Columns are `timestamp` holding UTC (Prisma convention): plain NOW() would follow the session
      // TimeZone and shift every comparison by the server's UTC offset.
      const batch = await prisma.$queryRaw<{ id: string; requestId: string; status: string; attempts: number }[]>`
        UPDATE "WebsiteEmail" SET "attempts" = "attempts" + 1, "nextAttemptAt" = (NOW() AT TIME ZONE 'UTC') + ${`${LEASE_MINUTES} minutes`}::interval
        WHERE "id" IN (
          SELECT "id" FROM "WebsiteEmail"
          WHERE "sentAt" IS NULL AND "attempts" < ${MAX_ATTEMPTS} AND "nextAttemptAt" <= (NOW() AT TIME ZONE 'UTC')
          ORDER BY "createdAt" LIMIT 20 FOR UPDATE SKIP LOCKED
        )
        RETURNING "id", "requestId", "status", "attempts"`;
      for (const email of batch) {
        const request = await prisma.websiteRequest.findUnique({ where: { id: email.requestId } });
        const sent = request ? await sendRequestMail({ ...request, status: email.status }) : false;
        if (sent) {
          await prisma.websiteEmail.update({ where: { id: email.id }, data: { sentAt: new Date(), lastError: '' } });
          continue;
        }
        const exhausted = email.attempts >= MAX_ATTEMPTS;
        const delay = BACKOFF_MINUTES[Math.min(email.attempts - 1, BACKOFF_MINUTES.length - 1)];
        await prisma.websiteEmail.update({ where: { id: email.id }, data: {
          lastError: request ? 'Envoi SMTP impossible' : 'Demande supprimée',
          nextAttemptAt: new Date(Date.now() + delay * 60000),
        } });
        if (exhausted) logger.error({ reference: request?.reference, status: email.status }, 'Email de suivi abandonné après plusieurs tentatives');
      }
      if (batch.length === 20) again = true;
    } while (again);
  } finally {
    running = false;
  }
}

// Fire-and-forget right after a commit so the guest gets the email in seconds rather than at the
// next scheduler tick; the scheduler remains the safety net.
export function kickOutbox() {
  setImmediate(() => { processOutbox().catch(err => logger.error({ err }, 'Échec du traitement des emails de suivi')); });
}
