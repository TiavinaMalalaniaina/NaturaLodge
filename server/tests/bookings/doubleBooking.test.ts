import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { resetDb } from '../helpers/db';
import { bookingBody, createGuest, createRoom, createStaff, day } from '../helpers/factories';

describe('Double réservation', () => {
  beforeEach(resetDb);

  it('refuse une seconde réservation qui chevauche la première', async () => {
    const { auth } = await createStaff('GERANT');
    const room = await createRoom();
    const [a, b] = [await createGuest(), await createGuest()];

    await request(app).post('/api/bookings').set(auth).send(bookingBody(a.id, [room.id], day(5), day(8))).expect(201);
    const res = await request(app).post('/api/bookings').set(auth).send(bookingBody(b.id, [room.id], day(7), day(10)));

    expect(res.status).toBe(409);
  });

  it('accepte deux séjours qui se touchent (départ = arrivée suivante)', async () => {
    const { auth } = await createStaff('GERANT');
    const room = await createRoom();
    const [a, b] = [await createGuest(), await createGuest()];

    await request(app).post('/api/bookings').set(auth).send(bookingBody(a.id, [room.id], day(5), day(8))).expect(201);
    await request(app).post('/api/bookings').set(auth).send(bookingBody(b.id, [room.id], day(8), day(10))).expect(201);
  });

  it('sous concurrence, une seule réservation passe sur la même chambre (verrou FOR UPDATE)', async () => {
    const { auth } = await createStaff('GERANT');
    const room = await createRoom();
    const guests = await Promise.all(Array.from({ length: 6 }, () => createGuest()));

    const responses = await Promise.all(
      guests.map(g => request(app).post('/api/bookings').set(auth).send(bookingBody(g.id, [room.id], day(5), day(8)))),
    );

    const statuses = responses.map(r => r.status).sort();
    expect(statuses.filter(s => s === 201)).toHaveLength(1);
    expect(statuses.filter(s => s === 409)).toHaveLength(guests.length - 1);
  });

  it('libère la chambre quand la réservation est annulée', async () => {
    const { auth } = await createStaff('GERANT');
    const room = await createRoom();
    const [a, b] = [await createGuest(), await createGuest()];

    const first = await request(app).post('/api/bookings').set(auth).send(bookingBody(a.id, [room.id], day(5), day(8))).expect(201);
    await request(app).patch(`/api/bookings/${first.body.id}/status`).set(auth).send({ status: 'CANCELLED' }).expect(200);

    await request(app).post('/api/bookings').set(auth).send(bookingBody(b.id, [room.id], day(5), day(8))).expect(201);
  });

  it('« Annuler l’annulation » est refusé si la chambre a été reprise entre-temps', async () => {
    const { auth } = await createStaff('GERANT');
    const room = await createRoom();
    const [a, b] = [await createGuest(), await createGuest()];

    const first = await request(app).post('/api/bookings').set(auth).send(bookingBody(a.id, [room.id], day(5), day(8))).expect(201);
    await request(app).patch(`/api/bookings/${first.body.id}/status`).set(auth).send({ status: 'CANCELLED' }).expect(200);
    await request(app).post('/api/bookings').set(auth).send(bookingBody(b.id, [room.id], day(6), day(9))).expect(201);

    const revert = await request(app).patch(`/api/bookings/${first.body.id}/status`).set(auth).send({ status: 'CONFIRMED' });
    expect(revert.status).toBe(409);
  });

  it('refuse une chambre en maintenance', async () => {
    const { auth } = await createStaff('GERANT');
    const room = await createRoom({ status: 'MAINTENANCE' });
    const guest = await createGuest();

    const res = await request(app).post('/api/bookings').set(auth).send(bookingBody(guest.id, [room.id], day(5), day(8)));
    expect(res.status).toBe(409);
  });
});
