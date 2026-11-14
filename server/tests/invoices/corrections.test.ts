import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { bookingBody, createGuest, createRoom, createStaff, day } from '../helpers/factories';
import { accountId, balance, totals } from '../helpers/ledger';

type Auth = { Authorization: string };

// Séjour 2 nuits × 100 000 Ar par chambre, TVA 20 % → HT 200 000, TVA 40 000, total 240 000.
const TOTAL = 240_000;

async function staff() {
  const [gerant, manager] = [await createStaff('GERANT'), await createStaff('MANAGER')];
  return { gerant: gerant.auth, manager: manager.auth };
}

async function stay(gerant: Auth, rooms = 1) {
  const guest = await createGuest();
  const roomIds: string[] = [];
  for (let i = 0; i < rooms; i++) roomIds.push((await createRoom()).id);
  const bookingId = (await request(app).post('/api/bookings').set(gerant).send(bookingBody(guest.id, roomIds, day(-1), day(1))).expect(201)).body.id as string;
  const invoiceId = (await request(app).post('/api/invoices/generate').set(gerant).send({ bookingId, taxRate: 20 }).expect(201)).body.id as string;
  return { bookingId, invoiceId, roomIds };
}

async function validatedStay(gerant: Auth, manager: Auth, rooms = 1) {
  const s = await stay(gerant, rooms);
  await request(app).post(`/api/invoices/${s.invoiceId}/validate`).set(manager).expect(200);
  return s;
}

const validate = (auth: Auth, id: string) => request(app).post(`/api/invoices/${id}/validate`).set(auth);
const invoice = (id: string) => prisma.invoice.findUniqueOrThrow({ where: { id } });
const paymentStatus = async (auth: Auth, bookingId: string) => (await request(app).get(`/api/bookings/${bookingId}`).set(auth).expect(200)).body.paymentStatus;

async function pay(auth: Auth, invoiceId: string, amount: number) {
  return request(app).post(`/api/invoices/${invoiceId}/payments`).set(auth).send({ amount, method: 'CASH', accountId: await accountId('530000') });
}
async function refund(auth: Auth, invoiceId: string, amount: number) {
  return request(app).post(`/api/invoices/${invoiceId}/refunds`).set(auth).send({ amount, method: 'CASH', accountId: await accountId('530000') });
}

describe('Facture visée modifiable', () => {
  beforeEach(resetDb);

  it('lignes, remises et TVA restent modifiables ; chaque variation passe une écriture correctrice', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId } = await validatedStay(gerant, manager);

    await request(app).post(`/api/invoices/${invoiceId}/items`).set(manager).send({ description: 'Minibar', quantity: 1, unitPrice: 10_000 }).expect(201);
    expect(await balance('706000')).toBe(-210_000);
    await request(app).post(`/api/invoices/${invoiceId}/discounts`).set(manager).send({ mode: 'fixed', value: 5_000 }).expect(201);
    expect(await balance('709000')).toBe(5_000);
    await request(app).patch(`/api/invoices/${invoiceId}`).set(manager).send({ taxAmount: 41_000 }).expect(200);
    expect(await balance('4457000')).toBe(-41_000);

    expect((await invoice(invoiceId)).totalAmount).toBe(TOTAL + 10_000 - 5_000 + 1_000);
    expect(await balance('411000')).toBe(TOTAL + 10_000 - 5_000 + 1_000);
    const { debit, credit } = await totals();
    expect(debit).toBe(credit);
  });
});

describe('La facture suit le séjour', () => {
  beforeEach(resetDb);

  it('brouillon : lignes et TVA suivent une chambre ajoutée', async () => {
    const { gerant, manager } = await staff();
    const { bookingId, invoiceId } = await stay(gerant);
    const extra = await createRoom();

    await request(app).post(`/api/bookings/${bookingId}/rooms`).set(manager).send({ roomId: extra.id, roomRate: 100_000 }).expect(201);

    expect(await invoice(invoiceId)).toMatchObject({ totalAmount: 2 * TOTAL, taxAmount: 80_000 });
    expect(await totals()).toEqual({ debit: 0, credit: 0 });
  });

  it('visée : une chambre ajoutée puis retirée passe ses écritures correctrices', async () => {
    const { gerant, manager } = await staff();
    const { bookingId, invoiceId } = await validatedStay(gerant, manager);
    await pay(gerant, invoiceId, TOTAL);
    const extra = await createRoom();

    await request(app).post(`/api/bookings/${bookingId}/rooms`).set(manager).send({ roomId: extra.id, roomRate: 100_000 }).expect(201);
    expect(await invoice(invoiceId)).toMatchObject({ totalAmount: 2 * TOTAL, taxAmount: 80_000, status: 'PARTIALLY_PAID' });
    expect(await balance('706000')).toBe(-400_000);
    expect(await balance('4457000')).toBe(-80_000);
    expect(await balance('411000')).toBe(TOTAL);
    expect(await paymentStatus(gerant, bookingId)).toBe('partially_paid');

    await request(app).delete(`/api/bookings/${bookingId}/rooms/${extra.id}`).set(manager).expect(200);
    expect(await invoice(invoiceId)).toMatchObject({ totalAmount: TOTAL, taxAmount: 40_000, status: 'PAID' });
    expect(await balance('706000')).toBe(-200_000);
    expect(await balance('411000')).toBe(0);
    const { debit, credit } = await totals();
    expect(debit).toBe(credit);
  });

  it('séjour réduit après paiement : le trop-perçu se rembourse', async () => {
    const { gerant, manager } = await staff();
    const { bookingId, invoiceId, roomIds } = await validatedStay(gerant, manager, 2);
    await pay(gerant, invoiceId, 2 * TOTAL);

    await request(app).delete(`/api/bookings/${bookingId}/rooms/${roomIds[1]}`).set(manager).expect(200);
    expect(await balance('411000')).toBe(-TOTAL);

    expect((await refund(gerant, invoiceId, TOTAL + 1)).status).toBe(409);
    expect((await refund(gerant, invoiceId, TOTAL)).status).toBe(201);
    expect(await balance('411000')).toBe(0);
    expect(await balance('530000')).toBe(TOTAL);
    expect((await invoice(invoiceId)).status).toBe('PAID');
  });

  it('une déduction d’acompte n’est jamais réécrite par la synchronisation', async () => {
    const { gerant, manager } = await staff();
    const { bookingId, invoiceId } = await stay(gerant);
    await request(app).post('/api/invoices/deposit').set(gerant)
      .send({ bookingId, amount: 100_000, method: 'CASH', accountId: await accountId('530000') }).expect(201);
    await validate(manager, invoiceId).expect(200);
    const extra = await createRoom();

    await request(app).post(`/api/bookings/${bookingId}/rooms`).set(manager).send({ roomId: extra.id, roomRate: 100_000 }).expect(201);

    expect((await invoice(invoiceId)).totalAmount).toBe(2 * TOTAL - 100_000);
    const items = await prisma.invoiceItem.findMany({ where: { invoiceId } });
    expect(items.filter(i => i.total === -100_000)).toHaveLength(1);
  });
});

describe('Visa automatique au check-out', () => {
  beforeEach(resetDb);

  it('le brouillon est visé au départ ; le séjour passe impayé', async () => {
    const { gerant, manager } = await staff();
    const { bookingId, invoiceId } = await stay(gerant);

    await request(app).patch(`/api/bookings/${bookingId}/status`).set(manager).send({ status: 'CHECKED_OUT' }).expect(200);

    const issued = await invoice(invoiceId);
    expect(issued.validatedAt).not.toBeNull();
    expect(issued.number).toMatch(/^INV-/);
    expect(await balance('411000')).toBe(TOTAL);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe('CHECKED_OUT_UNPAID');
  });
});

describe('Trop-perçu', () => {
  beforeEach(resetDb);

  it('se rembourse sur la facture, plafonné ; annuler le remboursement le rétablit', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId } = await validatedStay(gerant, manager);
    expect((await pay(manager, invoiceId, TOTAL + 10_000)).status).toBe(201);
    expect(await balance('411000')).toBe(-10_000);

    expect((await refund(gerant, invoiceId, 10_001)).status).toBe(409);
    const refunded = await refund(gerant, invoiceId, 10_000);
    expect(refunded.status).toBe(201);
    expect(await balance('411000')).toBe(0);
    expect(await balance('530000')).toBe(TOTAL);
    expect((await invoice(invoiceId)).status).toBe('PAID');
    expect((await refund(gerant, invoiceId, 1)).status).toBe(409);

    const refundPayment = refunded.body.payments.find((p: { amount: number }) => p.amount < 0);
    await request(app).delete(`/api/invoices/${invoiceId}/payments/${refundPayment.id}`).set(manager).expect(200);
    expect(await balance('411000')).toBe(-10_000);
    expect(await balance('530000')).toBe(TOTAL + 10_000);
    const { debit, credit } = await totals();
    expect(debit).toBe(credit);
  });
});

describe('Statut d’un avoir resynchronisé', () => {
  beforeEach(resetDb);

  // Régression : annuler un paiement de la facture créditée laissait l'avoir « à rembourser ».
  it('suit les paiements de la facture qu’il crédite', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId } = await validatedStay(gerant, manager);
    const paymentId = (await pay(gerant, invoiceId, 100_000)).body.payments[0].id as string;
    const credit = (await request(app).post(`/api/invoices/${invoiceId}/cancel`).set(manager).send({}).expect(200)).body.creditNote;
    await validate(manager, credit.id).expect(200);
    expect((await invoice(credit.id)).status).toBe('PENDING');

    await request(app).delete(`/api/invoices/${invoiceId}/payments/${paymentId}`).set(manager).expect(200);
    expect((await invoice(credit.id)).status).toBe('PAID');
    expect((await pay(gerant, credit.id, 1)).status).toBe(409);
  });
});

describe('Annulation d’une facture : frais retenus en 708500', () => {
  beforeEach(resetDb);

  it('la part retenue HT quitte le chiffre d’affaires séjour, sa TVA reste collectée', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId } = await validatedStay(gerant, manager);
    const credit = (await request(app).post(`/api/invoices/${invoiceId}/cancel`).set(manager).send({}).expect(200)).body.creditNote;
    expect(credit).toMatchObject({ totalAmount: 168_000, taxAmount: 28_000, retainedAmount: 60_000 });

    await validate(manager, credit.id).expect(200);
    expect(await balance('706000')).toBe(0);
    expect(await balance('708500')).toBe(-60_000);
    expect(await balance('4457000')).toBe(-12_000);
    expect(await balance('411000')).toBe(72_000);
  });
});
