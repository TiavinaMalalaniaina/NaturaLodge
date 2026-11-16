import request from 'supertest';
import { BookingStatus } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { resetDb } from '../helpers/db';
import { createStaff, insertBooking } from '../helpers/factories';

const ALL: BookingStatus[] = ['CONFIRMED', 'CHECKED_IN', 'AWAITING', 'CANCELLED', 'CHECKED_OUT_UNPAID', 'CHECKED_OUT_PAID', 'CLOSED'];

describe('GET /api/bookings — filtre par défaut', () => {
  beforeEach(resetDb);

  it('masque annulées, soldées et clôturées ; garde CHECKED_OUT_UNPAID à suivre', async () => {
    const { auth } = await createStaff('GERANT');
    for (const status of ALL) await insertBooking(status);

    const res = await request(app).get('/api/bookings').set(auth).expect(200);
    const statuses = (res.body.data as { status: BookingStatus }[]).map(b => b.status).sort();

    expect(statuses).toEqual(['AWAITING', 'CHECKED_IN', 'CHECKED_OUT_UNPAID', 'CONFIRMED']);
  });

  it('un statut explicite lève l’exclusion', async () => {
    const { auth } = await createStaff('GERANT');
    for (const status of ALL) await insertBooking(status);

    const res = await request(app).get('/api/bookings').query({ status: 'CLOSED' }).set(auth).expect(200);
    expect((res.body.data as { status: BookingStatus }[]).map(b => b.status)).toEqual(['CLOSED']);
  });

  it('une recherche lève l’exclusion', async () => {
    const { auth } = await createStaff('GERANT');
    await insertBooking('CLOSED', { guestName: 'Rakoto Archivé' });

    const res = await request(app).get('/api/bookings').query({ search: 'rakoto' }).set(auth).expect(200);
    expect(res.body.data).toHaveLength(1);
  });
});
