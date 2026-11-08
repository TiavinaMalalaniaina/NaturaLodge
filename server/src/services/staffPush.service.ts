import webpush from 'web-push';
import { WebsiteEventKind } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { roleHasPermission } from '../lib/permissions';

// Web Push: notifications shown by the admin PWA's service worker even when no admin tab is open.
// Keys are generated once with `npx web-push generate-vapid-keys` (see server/.env.example).
let configured: boolean | null = null;
function ready() {
  if (configured === null) {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    configured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
    if (configured) webpush.setVapidDetails(VAPID_SUBJECT!, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
    else logger.warn('Notifications push désactivées : VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT manquants');
  }
  return configured;
}

export const pushPublicKey = () => ({ publicKey: ready() ? process.env.VAPID_PUBLIC_KEY! : null });

export async function subscribe(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string) {
  // The endpoint identifies the device: re-subscribing (or another staff member logging in on the
  // same browser) moves it to the current user instead of duplicating it.
  await prisma.staffPushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent.slice(0, 200) },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent.slice(0, 200) },
  });
}

export async function unsubscribe(userId: string, endpoint: string) {
  await prisma.staffPushSubscription.deleteMany({ where: { userId, endpoint } });
}

const titles: Record<WebsiteEventKind, string> = {
  REQUEST_RECEIVED: 'Nouvelle demande du site',
  PROOF_UPLOADED: 'Preuve de paiement reçue',
  CANCELLED_BY_GUEST: 'Demande annulée par le client',
  EXPIRED: 'Délai de paiement expiré',
  DEPOSIT_CONFIRMED: 'Acompte reçu · séjour confirmé',
};
const day = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'short' });
// An event older than this is marked as handled without being sent (e.g. keys configured later).
const MAX_AGE_MS = 3600000;

let running = false;
let again = false;

export async function processPendingPushes(): Promise<void> {
  if (running) { again = true; return; }
  running = true;
  try {
    do {
      again = false;
      // Claimed by marking pushedAt first (SKIP LOCKED): at most once per event, even with several instances.
      // Age computed in SQL: the column is a UTC timestamp without time zone, which JS would misread.
      const batch = await prisma.$queryRaw<{ id: string; kind: WebsiteEventKind; requestId: string; ageSeconds: number }[]>`
        UPDATE "WebsiteEvent" SET "pushedAt" = (NOW() AT TIME ZONE 'UTC')
        WHERE "id" IN (SELECT "id" FROM "WebsiteEvent" WHERE "pushedAt" IS NULL ORDER BY "createdAt" LIMIT 20 FOR UPDATE SKIP LOCKED)
        RETURNING "id", "kind", "requestId", EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - "createdAt"))::float8 AS "ageSeconds"`;
      if (!batch.length) break;
      if (batch.length === 20) again = true;
      const fresh = batch.filter(event => event.ageSeconds * 1000 < MAX_AGE_MS);
      if (!fresh.length || !ready()) continue;
      const subscriptions = await prisma.staffPushSubscription.findMany({ where: { user: { status: 'ACTIVE' } }, include: { user: { select: { role: { select: { name: true } } } } } });
      const allowed = [];
      for (const sub of subscriptions) if (await roleHasPermission(sub.user.role.name, 'bookings.view')) allowed.push(sub);
      if (!allowed.length) continue;
      const requests = await prisma.websiteRequest.findMany({ where: { id: { in: fresh.map(e => e.requestId) } }, select: { id: true, name: true, arrival: true, departure: true } });
      for (const event of fresh) {
        const request = requests.find(r => r.id === event.requestId);
        if (!request) continue;
        const payload = JSON.stringify({ title: titles[event.kind], body: `${request.name} · ${day(request.arrival)} → ${day(request.departure)}`, url: '/website-requests', tag: event.id });
        await Promise.all(allowed.map(async sub => {
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 6 * 3600, urgency: 'high' });
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            // 404/410: the device unsubscribed or the browser data was cleared.
            if (status === 404 || status === 410) await prisma.staffPushSubscription.deleteMany({ where: { id: sub.id } });
            else logger.error({ status, message: (error as Error).message }, 'Échec de l’envoi d’une notification push');
          }
        }));
      }
    } while (again);
  } finally {
    running = false;
  }
}

export function kickPush() {
  setImmediate(() => { processPendingPushes().catch(err => logger.error({ err }, 'Échec du traitement des notifications push')); });
}
