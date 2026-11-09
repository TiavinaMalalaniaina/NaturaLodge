import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { resyncCheckoutPaymentStatus } from '../../src/services/booking.service';
import { prisma, resetDb } from '../helpers/db';
import { createStaff, insertBooking, insertInvoice } from '../helpers/factories';

async function statusOf(id: string) {
  return (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;
}

describe('Check-out', () => {
  beforeEach(resetDb);

  it('facture soldée → CHECKED_OUT_PAID (jamais CHECKED_OUT littéral)', async () => {
    const { auth } = await createStaff('GERANT');
    const { booking, guest } = await insertBooking('CHECKED_IN');
    await insertInvoice(booking.id, guest.id, 'PAID');

    await request(app).patch(`/api/bookings/${booking.id}/status`).set(auth).send({ status: 'CHECKED_OUT' }).expect(200);

    expect(await statusOf(booking.id)).toBe('CHECKED_OUT_PAID');
  });

  it('impayé : refusé pour un GERANT (sans bookings.checkout_unpaid)', async () => {
    const { auth } = await createStaff('GERANT');
    const { booking, guest } = await insertBooking('CHECKED_IN');
    await insertInvoice(booking.id, guest.id, 'PENDING');

    await request(app).patch(`/api/bookings/${booking.id}/status`).set(auth).send({ status: 'CHECKED_OUT' }).expect(403);
    expect(await statusOf(booking.id)).toBe('CHECKED_IN');
  });

  it('impayé : accepté pour un MANAGER → CHECKED_OUT_UNPAID', async () => {
    const { auth } = await createStaff('MANAGER');
    const { booking } = await insertBooking('CHECKED_IN');

    await request(app).patch(`/api/bookings/${booking.id}/status`).set(auth).send({ status: 'CHECKED_OUT' }).expect(200);
    expect(await statusOf(booking.id)).toBe('CHECKED_OUT_UNPAID');
  });

  it('incrémente totalStays du client', async () => {
    const { auth } = await createStaff('MANAGER');
    const { booking, guest } = await insertBooking('CHECKED_IN');

    await request(app).patch(`/api/bookings/${booking.id}/status`).set(auth).send({ status: 'CHECKED_OUT' }).expect(200);
    expect((await prisma.guest.findUniqueOrThrow({ where: { id: guest.id } })).totalStays).toBe(1);
  });
});

describe('Resynchronisation après paiement', () => {
  beforeEach(resetDb);

  it('CHECKED_OUT_UNPAID bascule en CHECKED_OUT_PAID une fois la facture soldée, et inversement', async () => {
    const { booking, guest } = await insertBooking('CHECKED_OUT_UNPAID');
    const invoice = await insertInvoice(booking.id, guest.id, 'PAID');

    await prisma.$transaction(tx => resyncCheckoutPaymentStatus(booking.id, tx));
    expect(await statusOf(booking.id)).toBe('CHECKED_OUT_PAID');

    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'PARTIALLY_PAID' } });
    await prisma.$transaction(tx => resyncCheckoutPaymentStatus(booking.id, tx));
    expect(await statusOf(booking.id)).toBe('CHECKED_OUT_UNPAID');
  });

  it('ne touche jamais une réservation CLOSED ni une réservation encore active', async () => {
    const closed = await insertBooking('CLOSED');
    await insertInvoice(closed.booking.id, closed.guest.id, 'PARTIALLY_PAID');
    const active = await insertBooking('CHECKED_IN');
    await insertInvoice(active.booking.id, active.guest.id, 'PAID');

    await prisma.$transaction(async tx => {
      await resyncCheckoutPaymentStatus(closed.booking.id, tx);
      await resyncCheckoutPaymentStatus(active.booking.id, tx);
    });

    expect(await statusOf(closed.booking.id)).toBe('CLOSED');
    expect(await statusOf(active.booking.id)).toBe('CHECKED_IN');
  });
});

describe('Clôture', () => {
  beforeEach(resetDb);

  it('refusée tant que la réservation n’est pas soldée (409)', async () => {
    const { auth } = await createStaff('MANAGER');
    const { booking } = await insertBooking('CHECKED_OUT_UNPAID');

    await request(app).patch(`/api/bookings/${booking.id}/close`).set(auth).expect(409);
    expect(await statusOf(booking.id)).toBe('CHECKED_OUT_UNPAID');
  });

  it('interdite au GERANT (403)', async () => {
    const { auth } = await createStaff('GERANT');
    const { booking } = await insertBooking('CHECKED_OUT_PAID');

    await request(app).patch(`/api/bookings/${booking.id}/close`).set(auth).expect(403);
  });

  it('acceptée pour un MANAGER depuis CHECKED_OUT_PAID', async () => {
    const { auth } = await createStaff('MANAGER');
    const { booking } = await insertBooking('CHECKED_OUT_PAID');

    const res = await request(app).patch(`/api/bookings/${booking.id}/close`).set(auth).expect(200);
    expect(res.body.status).toBe('CLOSED');
    expect(res.body.effectiveStatus).toBe('closed');
  });
});

describe('Accès', () => {
  beforeEach(resetDb);

  it('401 sans jeton', async () => {
    await request(app).get('/api/bookings').expect(401);
  });

  it('HOUSEKEEPING peut consulter mais pas créer ni changer un statut', async () => {
    const { auth } = await createStaff('HOUSEKEEPING');
    const { booking } = await insertBooking('CONFIRMED');

    await request(app).get('/api/bookings').set(auth).expect(200);
    await request(app).post('/api/bookings').set(auth).send({}).expect(403);
    await request(app).patch(`/api/bookings/${booking.id}/status`).set(auth).send({ status: 'CHECKED_IN' }).expect(403);
  });
});
