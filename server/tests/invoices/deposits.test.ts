import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { bookingBody, createGuest, createRoom, createStaff, day } from '../helpers/factories';
import { accountId, balance, totals } from '../helpers/ledger';

type Auth = { Authorization: string };

// Séjour 2 nuits × 100 000 Ar, TVA 20 % → total 240 000. Acompte 100 000.
const TOTAL = 240_000;
const DEPOSIT = 100_000;

async function staff() {
  const [gerant, manager] = [await createStaff('GERANT'), await createStaff('MANAGER')];
  return { gerant: gerant.auth, manager: manager.auth };
}

async function bookedStay(auth: Auth) {
  const guest = await createGuest();
  const room = await createRoom();
  const res = await request(app).post('/api/bookings').set(auth).send(bookingBody(guest.id, [room.id], day(-1), day(1))).expect(201);
  return res.body.id as string;
}

async function receiveDeposit(auth: Auth, bookingId: string, amount = DEPOSIT) {
  return request(app).post('/api/invoices/deposit').set(auth)
    .send({ bookingId, amount, method: 'CASH', accountId: await accountId('530000') });
}

async function draftInvoice(auth: Auth, bookingId: string) {
  return (await request(app).post('/api/invoices/generate').set(auth).send({ bookingId, taxRate: 20 }).expect(201)).body.id as string;
}

const validate = (auth: Auth, id: string) => request(app).post(`/api/invoices/${id}/validate`).set(auth);

async function pay(auth: Auth, invoiceId: string, amount: number) {
  return request(app).post(`/api/invoices/${invoiceId}/payments`).set(auth).send({ amount, method: 'CASH', accountId: await accountId('530000') });
}

const invoice = (id: string) => prisma.invoice.findUniqueOrThrow({ where: { id } });

describe('Encaissement d’un acompte', () => {
  beforeEach(resetDb);

  it('émet l’acompte visé et encaissé en un seul geste : argent en caisse, avance au passif', async () => {
    const { gerant } = await staff();
    const bookingId = await bookedStay(gerant);

    const res = await receiveDeposit(gerant, bookingId);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ kind: 'DEPOSIT', status: 'PAID', totalAmount: DEPOSIT });
    expect(res.body.number).toMatch(/^ACO-/);
    expect(await balance('530000')).toBe(DEPOSIT);
    expect(await balance('419100')).toBe(-DEPOSIT);
    expect(await balance('411000')).toBe(0);
    expect((await request(app).get('/api/invoices/deposits/outstanding').set((await createStaff('ADMIN')).auth).expect(200)).body).toHaveLength(1);
  });

  it('refuse un ancien brouillon d’acompte au visa', async () => {
    const { gerant, manager } = await staff();
    const bookingId = await bookedStay(gerant);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const draft = await prisma.invoice.create({ data: { kind: 'DEPOSIT', bookingId, guestId: booking.guestId, totalAmount: DEPOSIT } });

    expect((await validate(manager, draft.id)).status).toBe(409);
  });

  // Cas 1 : un acompte reçu après le visa n'était jamais déduit — le client payait deux fois.
  it('est refusé une fois la facture visée (l’argent se paie sur la facture)', async () => {
    const { gerant, manager } = await staff();
    const bookingId = await bookedStay(gerant);
    await validate(manager, await draftInvoice(gerant, bookingId)).expect(200);

    expect((await receiveDeposit(gerant, bookingId)).status).toBe(409);
    expect(await prisma.invoice.count({ where: { kind: 'DEPOSIT' } })).toBe(0);
  });

  it('est refusé sur une réservation annulée', async () => {
    const { gerant, manager } = await staff();
    const bookingId = await bookedStay(gerant);
    await request(app).patch(`/api/bookings/${bookingId}/status`).set(manager).send({ status: 'CANCELLED' }).expect(200);

    expect((await receiveDeposit(gerant, bookingId)).status).toBe(409);
  });
});

describe('Imputation au visa de la facture', () => {
  beforeEach(resetDb);

  it('déduit l’acompte, le rattache à la facture et solde le passif 419100', async () => {
    const { gerant, manager } = await staff();
    const bookingId = await bookedStay(gerant);
    const depositId = (await receiveDeposit(gerant, bookingId)).body.id as string;
    const invoiceId = await draftInvoice(gerant, bookingId);

    const res = await validate(manager, invoiceId).expect(200);

    expect(res.body.totalAmount).toBe(TOTAL - DEPOSIT);
    expect(res.body.items.find((i: { total: number }) => i.total === -DEPOSIT)).toBeDefined();
    expect((await invoice(depositId)).appliedToInvoiceId).toBe(invoiceId);
    expect(await balance('419100')).toBe(0);
    expect((await request(app).get('/api/invoices/deposits/outstanding').set(manager).expect(200)).body).toHaveLength(0);

    expect((await pay(gerant, invoiceId, TOTAL - DEPOSIT)).status).toBe(201);
    expect((await invoice(invoiceId)).status).toBe('PAID');
    expect(await balance('411000')).toBe(0);
    expect(await balance('530000')).toBe(TOTAL);
  });

  // Cas 2 : un acompte annulé était quand même déduit — le client payait moins que dû.
  it('ne déduit pas un acompte annulé', async () => {
    const { gerant, manager } = await staff();
    const bookingId = await bookedStay(gerant);
    const depositId = (await receiveDeposit(gerant, bookingId)).body.id as string;
    const credit = (await request(app).post(`/api/invoices/${depositId}/cancel`).set(manager).send({ refundRatePercent: 100 }).expect(200)).body.creditNote;
    await validate(manager, credit.id).expect(200);
    expect((await pay(gerant, credit.id, DEPOSIT)).status).toBe(201);

    const res = await validate(manager, await draftInvoice(gerant, bookingId)).expect(200);

    expect(res.body.totalAmount).toBe(TOTAL);
    expect((await invoice(depositId)).appliedToInvoiceId).toBeNull();
    expect(await balance('419100')).toBe(0);
    expect(await balance('411000')).toBe(TOTAL);
  });

  // Cas 3 : un acompte visé mais impayé était déduit — la facture et la réservation passaient pour soldées.
  it('refuse le visa tant qu’un acompte n’est pas entièrement encaissé', async () => {
    const { gerant, manager } = await staff();
    const bookingId = await bookedStay(gerant);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    await prisma.invoice.create({
      data: { kind: 'DEPOSIT', number: 'ACO-ANCIEN-0001', validatedAt: new Date(), bookingId, guestId: booking.guestId, totalAmount: DEPOSIT },
    });
    const invoiceId = await draftInvoice(gerant, bookingId);

    expect((await validate(manager, invoiceId)).status).toBe(409);
    expect((await invoice(invoiceId)).validatedAt).toBeNull();
  });

  it('un acompte imputé ne se rembourse, ne s’annule ni ne s’encaisse plus séparément', async () => {
    const { gerant, manager } = await staff();
    const bookingId = await bookedStay(gerant);
    const deposit = (await receiveDeposit(gerant, bookingId)).body;
    await validate(manager, await draftInvoice(gerant, bookingId)).expect(200);

    await request(app).delete(`/api/invoices/${deposit.id}/payments/${deposit.payments[0].id}`).set(manager).expect(409);
    await request(app).post(`/api/invoices/${deposit.id}/cancel`).set(manager).send({}).expect(409);
    expect(await balance('530000')).toBe(DEPOSIT);
  });

  it('acompte reçu pendant le visa : soit imputé, soit refusé — jamais payé deux fois', async () => {
    const { gerant, manager } = await staff();
    const bookingId = await bookedStay(gerant);
    const invoiceId = await draftInvoice(gerant, bookingId);

    const [deposit, validated] = await Promise.all([receiveDeposit(gerant, bookingId), validate(manager, invoiceId)]);

    expect(validated.status).toBe(200);
    if (deposit.status === 201) {
      expect((await invoice(deposit.body.id)).appliedToInvoiceId).toBe(invoiceId);
      expect((await invoice(invoiceId)).totalAmount).toBe(TOTAL - DEPOSIT);
    } else {
      expect(deposit.status).toBe(409);
      expect((await invoice(invoiceId)).totalAmount).toBe(TOTAL);
    }
    expect(await balance('419100')).toBe(0);
  });
});

describe('Annulation d’une réservation dont l’acompte est imputé', () => {
  beforeEach(resetDb);

  // Cas 4 : l'acompte recevait un second avoir — 419100 débité deux fois, frais d'annulation gonflés.
  it('un seul avoir, calculé sur le séjour entier ; seul le trop-payé au-delà de la part retenue est rendu', async () => {
    const { gerant, manager } = await staff();
    const bookingId = await bookedStay(gerant);
    const depositId = (await receiveDeposit(gerant, bookingId)).body.id as string;
    const invoiceId = await draftInvoice(gerant, bookingId);
    await validate(manager, invoiceId).expect(200);

    await request(app).patch(`/api/bookings/${bookingId}/status`).set(manager).send({ status: 'CANCELLED' }).expect(200);

    const credits = await prisma.invoice.findMany({ where: { kind: 'CREDIT_NOTE' } });
    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({ relatesToInvoiceId: invoiceId, totalAmount: TOTAL * 0.7 });
    expect((await invoice(depositId)).status).toBe('PAID');

    await validate(manager, credits[0].id).expect(200);
    expect(await balance('419100')).toBe(0);
    expect(await balance('708500')).toBe(0);

    // Retenu : 30 % du séjour = 72 000 ; le client a payé 100 000 → 28 000 à rendre.
    expect((await pay(gerant, credits[0].id, 28_001)).status).toBe(409);
    expect((await pay(gerant, credits[0].id, 28_000)).status).toBe(201);
    expect((await invoice(credits[0].id)).status).toBe('PAID');
    expect(await balance('530000')).toBe(72_000);
    expect(await balance('411000')).toBe(0);

    const { debit, credit } = await totals();
    expect(debit).toBe(credit);
  });
});

describe('Acompte attendu', () => {
  beforeEach(resetDb);

  it('une nuit pour l’ensemble des chambres ; reçu et reste suivent les encaissements', async () => {
    const { gerant, manager } = await staff();
    const bookingId = await bookedStay(gerant);
    const status = () => request(app).get(`/api/invoices/deposits/status/${bookingId}`).set(gerant).expect(200).then(r => r.body);

    expect(await status()).toMatchObject({ expected: 100_000, received: 0, remaining: 100_000 });

    const deposit = (await receiveDeposit(gerant, bookingId, 40_000)).body;
    expect(await status()).toMatchObject({ expected: 100_000, received: 40_000, remaining: 60_000 });

    await request(app).delete(`/api/invoices/${deposit.id}/payments/${deposit.payments[0].id}`).set(manager).expect(200);
    expect(await status()).toMatchObject({ expected: 100_000, received: 0, remaining: 100_000 });
  });

  it('une demande du site fait foi pour le montant attendu', async () => {
    const { gerant } = await staff();
    const bookingId = await bookedStay(gerant);
    await prisma.websiteRequest.create({
      data: {
        reference: 'TEST-ACOMPTE', idempotencyKeyHash: 'k', payloadHash: 'p', name: 'Client', email: 'client@example.test', phone: '0340000000',
        arrival: day(-1), departure: day(1), guests: 1, lines: [], totalAmount: 300_000, depositAmount: 150_000, bookingId,
      },
    });

    expect((await request(app).get(`/api/invoices/deposits/status/${bookingId}`).set(gerant).expect(200)).body.expected).toBe(150_000);
  });
});

describe('Annulation d’un acompte', () => {
  beforeEach(resetDb);

  const cancel = (auth: Auth, id: string, refundRatePercent: number) =>
    request(app).post(`/api/invoices/${id}/cancel`).set(auth).send({ refundRatePercent }).expect(200).then(r => r.body.creditNote);

  it('à 100 % : avoir, remboursement, plus rien en attente', async () => {
    const { gerant, manager } = await staff();
    const bookingId = await bookedStay(gerant);
    const depositId = (await receiveDeposit(gerant, bookingId)).body.id as string;

    const credit = await cancel(manager, depositId, 100);
    await validate(manager, credit.id).expect(200);
    expect((await pay(gerant, credit.id, DEPOSIT)).status).toBe(201);

    expect((await invoice(depositId)).status).toBe('CANCELLED');
    expect((await invoice(credit.id)).status).toBe('PAID');
    expect(await balance('419100')).toBe(0);
    expect(await balance('530000')).toBe(0);
    expect(await balance('411000')).toBe(0);
    expect((await request(app).get(`/api/invoices/deposits/status/${bookingId}`).set(gerant).expect(200)).body.received).toBe(0);
  });

  it('avec frais retenus : la part retenue devient un produit, le reste est rendu', async () => {
    const { gerant, manager } = await staff();
    const bookingId = await bookedStay(gerant);
    const depositId = (await receiveDeposit(gerant, bookingId)).body.id as string;

    const credit = await cancel(manager, depositId, 70);
    expect(credit.totalAmount).toBe(70_000);
    await validate(manager, credit.id).expect(200);
    expect((await pay(gerant, credit.id, 70_001)).status).toBe(409);
    expect((await pay(gerant, credit.id, 70_000)).status).toBe(201);

    expect(await balance('708500')).toBe(-30_000);
    expect(await balance('530000')).toBe(30_000);
    expect(await balance('411000')).toBe(0);
  });

  it('acompte dont le paiement a été annulé : aucun frais retenu, rien à rendre', async () => {
    const { gerant, manager } = await staff();
    const bookingId = await bookedStay(gerant);
    const deposit = (await receiveDeposit(gerant, bookingId)).body;
    await request(app).delete(`/api/invoices/${deposit.id}/payments/${deposit.payments[0].id}`).set(manager).expect(200);

    const credit = await cancel(manager, deposit.id, 70);
    expect(credit.totalAmount).toBe(DEPOSIT);
    await validate(manager, credit.id).expect(200);

    expect((await invoice(credit.id)).status).toBe('PAID');
    expect(await balance('708500')).toBe(0);
    expect(await balance('411000')).toBe(0);
    expect(await balance('419100')).toBe(0);
    // Plus d'acompte en suspens : la facture peut être visée.
    await validate(manager, await draftInvoice(gerant, bookingId)).expect(200);
  });
});

describe('Demande du site', () => {
  beforeEach(resetDb);

  it('l’encaissement de l’acompte ne confirme plus la demande : le personnel la confirme lui-même', async () => {
    const { gerant } = await staff();
    const guest = await createGuest();
    const room = await createRoom();
    const bookingId = (await request(app).post('/api/bookings').set(gerant).send(bookingBody(guest.id, [room.id], day(1), day(3), 'AWAITING')).expect(201)).body.id as string;
    const site = await prisma.websiteRequest.create({
      data: {
        reference: 'TEST-CONFIRM', idempotencyKeyHash: 'k2', payloadHash: 'p2', name: 'Client', email: 'client@example.test', phone: '0340000000',
        arrival: day(1), departure: day(3), guests: 1, lines: [], totalAmount: 200_000, depositAmount: DEPOSIT,
        status: 'AWAITING_PAYMENT', expiresAt: day(2), bookingId,
      },
    });

    expect((await receiveDeposit(gerant, bookingId)).status).toBe(201);

    expect((await prisma.websiteRequest.findUniqueOrThrow({ where: { id: site.id } })).status).toBe('AWAITING_PAYMENT');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe('AWAITING');
    const status = (await request(app).get(`/api/invoices/deposits/status/${bookingId}`).set(gerant).expect(200)).body;
    expect(status).toMatchObject({ remaining: 0, websiteRequest: { id: site.id, reference: 'TEST-CONFIRM', status: 'AWAITING_PAYMENT' } });

    await request(app).post(`/api/website-requests/${site.id}/confirm`).set(gerant).expect(200);
    expect((await prisma.websiteRequest.findUniqueOrThrow({ where: { id: site.id } })).status).toBe('CONFIRMED');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe('CONFIRMED');
  });
});
