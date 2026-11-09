import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { bookingBody, createGuest, createRoom, createStaff, day } from '../helpers/factories';
import { accountId, balance, totals } from '../helpers/ledger';

type Auth = { Authorization: string };

// Séjour 2 nuits × 100 000 Ar, TVA 20 % → sous-total 200 000, TVA 40 000, total 240 000.
const SUBTOTAL = 200_000;
const TAX = 40_000;
const TOTAL = 240_000;

async function staff() {
  const [gerant, manager] = [await createStaff('GERANT'), await createStaff('MANAGER')];
  return { gerant: gerant.auth, manager: manager.auth };
}

async function bookedStay(auth: Auth) {
  const guest = await createGuest();
  const room = await createRoom();
  const res = await request(app).post('/api/bookings').set(auth).send(bookingBody(guest.id, [room.id], day(-1), day(1))).expect(201);
  return { bookingId: res.body.id as string, guestId: guest.id };
}

async function draftInvoice(auth: Auth, bookingId: string) {
  const res = await request(app).post('/api/invoices/generate').set(auth).send({ bookingId, taxRate: 20 }).expect(201);
  return res.body.id as string;
}

async function validatedInvoice(gerant: Auth, manager: Auth) {
  const stay = await bookedStay(gerant);
  const invoiceId = await draftInvoice(gerant, stay.bookingId);
  await request(app).post(`/api/invoices/${invoiceId}/validate`).set(manager).expect(200);
  return { ...stay, invoiceId };
}

async function pay(auth: Auth, invoiceId: string, amount: number, code = '530000', method = 'CASH') {
  return request(app).post(`/api/invoices/${invoiceId}/payments`).set(auth).send({ amount, method, accountId: await accountId(code) });
}

// Année de l'hôtel (Madagascar), comme src/lib/documentNumber.ts.
const YEAR = Number(new Intl.DateTimeFormat('en', { timeZone: 'Indian/Antananarivo', year: 'numeric' }).format(new Date()));

const invoice = (id: string) => prisma.invoice.findUniqueOrThrow({ where: { id } });
const bookingStatus = async (id: string) => (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;

describe('Génération (brouillon)', () => {
  beforeEach(resetDb);

  it('calcule lignes, TVA et total depuis la réservation, sans numéro ni écriture', async () => {
    const { gerant } = await staff();
    const { bookingId } = await bookedStay(gerant);

    const res = await request(app).post('/api/invoices/generate').set(gerant).send({ bookingId, taxRate: 20 }).expect(201);

    expect(res.body).toMatchObject({ number: null, validatedAt: null, totalAmount: TOTAL, taxAmount: TAX, status: 'PENDING' });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ quantity: 2, unitPrice: 100_000, total: SUBTOTAL });
    expect(await totals()).toEqual({ debit: 0, credit: 0 });
  });

  it('une seconde génération renvoie le même brouillon (200), sans doublon', async () => {
    const { gerant } = await staff();
    const { bookingId } = await bookedStay(gerant);
    const first = await draftInvoice(gerant, bookingId);

    const again = await request(app).post('/api/invoices/generate').set(gerant).send({ bookingId, taxRate: 20 }).expect(200);

    expect(again.body.id).toBe(first);
    expect(await prisma.invoice.count({ where: { bookingId } })).toBe(1);
  });
});

describe('Visa', () => {
  beforeEach(resetDb);

  it('attribue un numéro et constate créance / produit / TVA au grand livre', async () => {
    const { gerant, manager } = await staff();
    const { bookingId } = await bookedStay(gerant);
    const id = await draftInvoice(gerant, bookingId);

    const res = await request(app).post(`/api/invoices/${id}/validate`).set(manager).expect(200);

    expect(res.body.number).toBe(`INV-${YEAR}-0001`);
    expect(res.body.validatedAt).not.toBeNull();
    expect(await balance('411000')).toBe(TOTAL);
    expect(await balance('706000')).toBe(-SUBTOTAL);
    expect(await balance('4457000')).toBe(-TAX);
  });

  it('refuse un second visa (409) et un visa par un GERANT (403)', async () => {
    const { gerant, manager } = await staff();
    const { bookingId } = await bookedStay(gerant);
    const id = await draftInvoice(gerant, bookingId);

    await request(app).post(`/api/invoices/${id}/validate`).set(gerant).expect(403);
    await request(app).post(`/api/invoices/${id}/validate`).set(manager).expect(200);
    await request(app).post(`/api/invoices/${id}/validate`).set(manager).expect(409);
  });

  it('une facture visée ne se régénère plus (correction par avoir uniquement)', async () => {
    const { gerant, manager } = await staff();
    const { bookingId } = await validatedInvoice(gerant, manager);

    await request(app).post('/api/invoices/generate').set(gerant).send({ bookingId, taxRate: 20 }).expect(409);
  });

  it('la numérotation repart à 0001 chaque année et suit le plus grand numéro de l’année', async () => {
    const { gerant, manager } = await staff();
    const old = await validatedInvoice(gerant, manager);
    await prisma.invoice.update({ where: { id: old.invoiceId }, data: { number: `INV-${YEAR - 1}-0042` } });
    await prisma.journalEntry.updateMany({ data: { number: `JE-${YEAR - 1}-0099` } });

    const first = await draftInvoice(gerant, (await bookedStay(gerant)).bookingId);
    expect((await request(app).post(`/api/invoices/${first}/validate`).set(manager).expect(200)).body.number).toBe(`INV-${YEAR}-0001`);
    expect((await prisma.journalEntry.findFirstOrThrow({ where: { relatedInvoiceId: first } })).number).toBe(`JE-${YEAR}-0001`);

    await prisma.invoice.update({ where: { id: first }, data: { number: `INV-${YEAR}-0007` } });
    const second = await draftInvoice(gerant, (await bookedStay(gerant)).bookingId);
    expect((await request(app).post(`/api/invoices/${second}/validate`).set(manager).expect(200)).body.number).toBe(`INV-${YEAR}-0008`);
  });

  // Régression : la numérotation (count + 1) n'était pas sérialisée — l'un des visas échouait en 409.
  it('des visas simultanés réussissent tous avec des numéros distincts', async () => {
    const { gerant, manager } = await staff();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push(await draftInvoice(gerant, (await bookedStay(gerant)).bookingId));

    const responses = await Promise.all(ids.map(id => request(app).post(`/api/invoices/${id}/validate`).set(manager)));

    expect(responses.map(r => r.status)).toEqual([200, 200, 200]);
    expect(new Set(responses.map(r => r.body.number)).size).toBe(3);
  });
});

describe('Paiements', () => {
  beforeEach(resetDb);

  it('trop-perçu refusé sans la permission invoices.overpay (GERANT), y compris en complément d’un acompte partiel', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId } = await validatedInvoice(gerant, manager);

    expect((await pay(gerant, invoiceId, TOTAL + 1)).status).toBe(403);
    expect((await pay(gerant, invoiceId, 100_000)).status).toBe(201);
    expect((await pay(gerant, invoiceId, TOTAL - 100_000 + 1)).status).toBe(403);
    expect((await pay(gerant, invoiceId, TOTAL - 100_000)).status).toBe(201);
    expect(await balance('411000')).toBe(0);
  });

  it('trop-perçu accepté avec la permission (MANAGER) : facture soldée, excédent au crédit du client', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId } = await validatedInvoice(gerant, manager);

    expect((await pay(manager, invoiceId, TOTAL + 10_000)).status).toBe(201);
    expect((await invoice(invoiceId)).status).toBe('PAID');
    expect(await balance('411000')).toBe(-10_000);
  });

  it('refusé sur un brouillon (409)', async () => {
    const { gerant } = await staff();
    const { bookingId } = await bookedStay(gerant);
    const id = await draftInvoice(gerant, bookingId);

    expect((await pay(gerant, id, 1_000)).status).toBe(409);
  });

  it('partiel puis complet : statut, trésorerie, créance et valeur client suivent', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId, guestId } = await validatedInvoice(gerant, manager);

    expect((await pay(gerant, invoiceId, 100_000)).status).toBe(201);
    expect((await invoice(invoiceId)).status).toBe('PARTIALLY_PAID');

    expect((await pay(gerant, invoiceId, TOTAL - 100_000)).status).toBe(201);
    const paid = await invoice(invoiceId);
    expect(paid.status).toBe('PAID');
    expect(paid.paidAt).not.toBeNull();

    expect(await balance('530000')).toBe(TOTAL);
    expect(await balance('411000')).toBe(0);
    expect((await prisma.guest.findUniqueOrThrow({ where: { id: guestId } })).lifetimeValue).toBe(TOTAL);

    expect((await pay(gerant, invoiceId, 1_000)).status).toBe(409);
  });

  it('annulation d’un paiement : contre-écriture, statut et valeur client rétablis ; réservée manager', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId, guestId } = await validatedInvoice(gerant, manager);
    const paymentId = (await pay(gerant, invoiceId, TOTAL)).body.payments[0].id as string;

    await request(app).delete(`/api/invoices/${invoiceId}/payments/${paymentId}`).set(gerant).expect(403);
    await request(app).delete(`/api/invoices/${invoiceId}/payments/${paymentId}`).set(manager).expect(200);
    await request(app).delete(`/api/invoices/${invoiceId}/payments/${paymentId}`).set(manager).expect(409);

    expect((await invoice(invoiceId)).status).toBe('PENDING');
    expect(await balance('530000')).toBe(0);
    expect(await balance('411000')).toBe(TOTAL);
    expect((await prisma.guest.findUniqueOrThrow({ where: { id: guestId } })).lifetimeValue).toBe(0);
  });

  // Régression : le numéro d'écriture comptable n'était pas sérialisé — deux encaissements
  // simultanés, même sur des factures différentes, collisionnaient et l'un échouait en 409.
  it('des encaissements simultanés sur des factures différentes réussissent tous', async () => {
    const { gerant, manager } = await staff();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await validatedInvoice(gerant, manager)).invoiceId);

    const responses = await Promise.all(ids.map(id => pay(gerant, id, 1_000)));

    expect(responses.map(r => r.status)).toEqual([201, 201, 201]);
  });

  // Régression : n'importe quel compte comptable était accepté (ex. « encaissement » sur 706000).
  it('refuse un paiement vers un compte qui n’est pas de la trésorerie', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId } = await validatedInvoice(gerant, manager);

    expect((await pay(gerant, invoiceId, 1_000, '706000')).status).toBe(409);
    expect(await balance('706000')).toBe(-SUBTOTAL);
  });

  it('refuse un moyen de paiement qui a son compte dédié ailleurs (Mvola sur la caisse)', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId } = await validatedInvoice(gerant, manager);

    expect((await pay(gerant, invoiceId, 1_000, '530000', 'MVOLA')).status).toBe(409);
    expect((await pay(gerant, invoiceId, 1_000, '517100', 'MVOLA')).status).toBe(201);
  });

  it('refuse un moyen de paiement sans compte dédié (carte)', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId } = await validatedInvoice(gerant, manager);

    expect((await pay(gerant, invoiceId, 1_000, '530000', 'CARD')).status).toBe(409);
    expect(await balance('530000')).toBe(0);
  });
});

describe('Statut de réservation piloté par les paiements (parcours réel)', () => {
  beforeEach(resetDb);

  it('check-out impayé → payé au solde → impayé si le paiement est annulé', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId, bookingId } = await validatedInvoice(gerant, manager);

    await request(app).patch(`/api/bookings/${bookingId}/status`).set(manager).send({ status: 'CHECKED_OUT' }).expect(200);
    expect(await bookingStatus(bookingId)).toBe('CHECKED_OUT_UNPAID');

    const paymentId = (await pay(gerant, invoiceId, TOTAL)).body.payments[0].id as string;
    expect(await bookingStatus(bookingId)).toBe('CHECKED_OUT_PAID');

    await request(app).delete(`/api/invoices/${invoiceId}/payments/${paymentId}`).set(manager).expect(200);
    expect(await bookingStatus(bookingId)).toBe('CHECKED_OUT_UNPAID');
  });

  it('un GERANT peut check-outer dès que la facture est soldée', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId, bookingId } = await validatedInvoice(gerant, manager);
    await pay(gerant, invoiceId, TOTAL);

    await request(app).patch(`/api/bookings/${bookingId}/status`).set(gerant).send({ status: 'CHECKED_OUT' }).expect(200);
    expect(await bookingStatus(bookingId)).toBe('CHECKED_OUT_PAID');
  });
});

describe('Annulation de facture', () => {
  beforeEach(resetDb);

  it('un brouillon est simplement supprimé', async () => {
    const { gerant, manager } = await staff();
    const { bookingId } = await bookedStay(gerant);
    const id = await draftInvoice(gerant, bookingId);

    const res = await request(app).post(`/api/invoices/${id}/cancel`).set(manager).send({}).expect(200);

    expect(res.body).toEqual({ deleted: true });
    expect(await prisma.invoice.count()).toBe(0);
  });

  it('une facture visée produit un avoir brouillon à 70 % ; son visa extourne au grand livre', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId } = await validatedInvoice(gerant, manager);

    const res = await request(app).post(`/api/invoices/${invoiceId}/cancel`).set(manager).send({}).expect(200);
    const credit = res.body.creditNote;

    expect((await invoice(invoiceId)).status).toBe('CANCELLED');
    expect(credit).toMatchObject({ kind: 'CREDIT_NOTE', number: null, totalAmount: TOTAL * 0.7, relatesToInvoiceId: invoiceId });
    expect(await balance('411000')).toBe(TOTAL);

    const validated = await request(app).post(`/api/invoices/${credit.id}/validate`).set(manager).expect(200);
    expect(validated.body.number).toBe(`AVO-${YEAR}-0001`);
    expect(await balance('411000')).toBe(TOTAL * 0.3);
  });

  it('pas de remboursement sur un avoir dont la facture n’a jamais été encaissée', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId } = await validatedInvoice(gerant, manager);
    const credit = (await request(app).post(`/api/invoices/${invoiceId}/cancel`).set(manager).send({}).expect(200)).body.creditNote;
    await request(app).post(`/api/invoices/${credit.id}/validate`).set(manager).expect(200);

    expect((await pay(gerant, credit.id, 1_000)).status).toBe(409);
  });

  it('remboursement plafonné à ce qui a été encaissé', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId } = await validatedInvoice(gerant, manager);
    await pay(gerant, invoiceId, 100_000);
    const credit = (await request(app).post(`/api/invoices/${invoiceId}/cancel`).set(manager).send({}).expect(200)).body.creditNote;
    await request(app).post(`/api/invoices/${credit.id}/validate`).set(manager).expect(200);

    expect((await pay(gerant, credit.id, 100_001)).status).toBe(409);
    expect((await pay(gerant, credit.id, 100_000)).status).toBe(201);
    expect(await balance('530000')).toBe(0);
  });
});

describe('Grand livre', () => {
  beforeEach(resetDb);

  it('reste équilibré après un parcours complet (visa, paiements, annulation, avoir, remboursement)', async () => {
    const { gerant, manager } = await staff();
    const { invoiceId } = await validatedInvoice(gerant, manager);
    const p1 = (await pay(gerant, invoiceId, 50_000)).body.payments[0].id as string;
    await pay(gerant, invoiceId, 30_000, '517100', 'MVOLA');
    await request(app).delete(`/api/invoices/${invoiceId}/payments/${p1}`).set(manager).expect(200);
    const credit = (await request(app).post(`/api/invoices/${invoiceId}/cancel`).set(manager).send({ refundRatePercent: 50 }).expect(200)).body.creditNote;
    await request(app).post(`/api/invoices/${credit.id}/validate`).set(manager).expect(200);
    await pay(gerant, credit.id, 30_000, '517100', 'MVOLA');

    const { debit, credit: creditSum } = await totals();
    expect(debit).toBeGreaterThan(0);
    expect(debit).toBe(creditSum);
    expect(await balance('517100')).toBe(0);
  });
});
