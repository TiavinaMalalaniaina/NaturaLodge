import { Prisma, WebsiteEventKind } from '@prisma/client';
import { prisma } from '../lib/prisma';

const RETENTION_DAYS = 30;

// Always called inside the transaction of the action it reports, so a rolled-back action never notifies.
export async function recordEvent(tx: Prisma.TransactionClient, requestId: string, kind: WebsiteEventKind) {
  await tx.websiteEvent.create({ data: { requestId, kind } });
}

// Staff consoles poll with the timestamp of the last event they received. Capped at 7 days back so a
// browser coming back after a long absence does not flood the bell.
export async function eventsSince(after: Date | undefined) {
  const floor = new Date(Date.now() - 7 * 86400000);
  const events = await prisma.websiteEvent.findMany({
    where: { createdAt: { gte: after && after > floor ? after : floor } },
    orderBy: { createdAt: 'asc' },
    take: 50,
    include: { request: { select: { id: true, name: true, arrival: true, departure: true, depositAmount: true, reference: true } } },
  });
  return events.map(event => ({ id: event.id, kind: event.kind, createdAt: event.createdAt, request: event.request }));
}

export async function purgeOldEvents() {
  await prisma.websiteEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86400000) } } });
}
