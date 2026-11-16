import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { resetDb } from '../helpers/db';
import { createStaff, RoleName } from '../helpers/factories';

const READ_ROUTES = ['/api/website-requests', '/api/website-requests/pending-count', '/api/website-requests/events', '/api/website-requests/payment-sheet'];

describe('Demandes du site — permission websiteRequests.view', () => {
  beforeEach(resetDb);

  it.each<RoleName>(['ADMIN', 'MANAGER', 'GERANT'])('%s consulte les demandes', async role => {
    const { auth } = await createStaff(role);
    for (const url of READ_ROUTES) {
      expect((await request(app).get(url).set(auth)).status, url).toBe(200);
    }
  });

  it('HOUSEKEEPING n’y a plus accès (alors qu’il garde bookings.view)', async () => {
    const { auth } = await createStaff('HOUSEKEEPING');

    for (const url of READ_ROUTES) {
      expect((await request(app).get(url).set(auth)).status, url).toBe(403);
    }
    await request(app).get('/api/website-requests/push/public-key').set(auth).expect(403);
    await request(app).get('/api/bookings').set(auth).expect(200);
  });

  it('un appareil peut toujours se désabonner des notifications, même sans la permission', async () => {
    const { auth } = await createStaff('HOUSEKEEPING');

    await request(app).post('/api/website-requests/push/unsubscribe').set(auth).send({ endpoint: 'https://push.example.com/x' }).expect(204);
  });
});
