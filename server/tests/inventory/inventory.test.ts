import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { createStaff, insertBooking } from '../helpers/factories';

type Auth = { Authorization: string };

async function createCategory(auth: Auth, name = 'Linge', family = 'LINEN_TABLEWARE') {
  const res = await request(app).post('/api/inventory/categories').set(auth).send({ name, family }).expect(201);
  return res.body as { id: string };
}

async function createItem(auth: Auth, categoryId: string, body: Record<string, unknown> = {}) {
  const res = await request(app).post('/api/inventory/items').set(auth)
    .send({ name: 'Drap 2 places', categoryId, ...body }).expect(201);
  return res.body as { id: string; quantity: number };
}

const move = (auth: Auth, body: Record<string, unknown>) => request(app).post('/api/inventory/movements').set(auth).send(body);

// Invariant du journal : la quantité de chaque article est la somme des deltas de ses mouvements.
async function expectJournalConsistent() {
  const items = await prisma.inventoryItem.findMany({ include: { movements: { select: { delta: true } } } });
  for (const item of items) {
    expect(item.movements.reduce((sum, m) => sum + m.delta, 0)).toBe(item.quantity);
  }
}

describe('Inventaire — articles et mouvements', () => {
  beforeEach(resetDb);

  it('crée un article avec sa quantité de départ et le mouvement INITIAL correspondant', async () => {
    const { auth } = await createStaff('MANAGER');
    const category = await createCategory(auth);
    const item = await createItem(auth, category.id, { initialQuantity: 30 });

    expect(item.quantity).toBe(30);
    const movements = await prisma.inventoryMovement.findMany({ where: { itemId: item.id } });
    expect(movements).toEqual([expect.objectContaining({ type: 'INITIAL', delta: 30, quantityAfter: 30 })]);
  });

  it('enregistre entrées et sorties, et refuse une sortie supérieure à la quantité', async () => {
    const { auth } = await createStaff('MANAGER');
    const category = await createCategory(auth, 'Accueil', 'CONSUMABLE');
    const item = await createItem(auth, category.id, { name: 'Savon', initialQuantity: 10 });

    await move(auth, { type: 'PURCHASE', itemId: item.id, quantity: 50, unitCost: 500 }).expect(201);
    await move(auth, { type: 'CONSUMPTION', itemId: item.id, quantity: 12 }).expect(201);
    const refused = await move(auth, { type: 'DISPOSAL', itemId: item.id, quantity: 49 });

    expect(refused.status).toBe(409);
    const stored = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.quantity).toBe(48);
    expect(stored.unitCost).toBe(500);
    await expectJournalConsistent();
  });

  it('sous concurrence, la quantité ne devient jamais négative (verrou FOR UPDATE)', async () => {
    const { auth } = await createStaff('MANAGER');
    const category = await createCategory(auth);
    const item = await createItem(auth, category.id, { initialQuantity: 2 });

    const responses = await Promise.all(
      Array.from({ length: 6 }, () => move(auth, { type: 'BREAKAGE', itemId: item.id, quantity: 1 })),
    );

    expect(responses.filter(r => r.status === 201)).toHaveLength(2);
    expect(responses.filter(r => r.status === 409)).toHaveLength(4);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).quantity).toBe(0);
    await expectJournalConsistent();
  });

  it('rattache une casse à une réservation', async () => {
    const { auth } = await createStaff('MANAGER');
    const category = await createCategory(auth, 'Vaisselle');
    const item = await createItem(auth, category.id, { name: 'Verre', initialQuantity: 20 });
    const { booking } = await insertBooking('CHECKED_IN');

    const res = await move(auth, { type: 'BREAKAGE', itemId: item.id, quantity: 2, bookingId: booking.id, reason: 'Tombés' }).expect(201);

    expect(res.body.booking).toEqual(expect.objectContaining({ id: booking.id }));
    expect(res.body.delta).toBe(-2);
  });

  it('applique les permissions par type de mouvement (HOUSEKEEPING : consommation et casse seulement)', async () => {
    const manager = await createStaff('MANAGER');
    const housekeeping = await createStaff('HOUSEKEEPING');
    const category = await createCategory(manager.auth);
    const item = await createItem(manager.auth, category.id, { initialQuantity: 10 });

    await move(housekeeping.auth, { type: 'CONSUMPTION', itemId: item.id, quantity: 1 }).expect(201);
    await move(housekeeping.auth, { type: 'BREAKAGE', itemId: item.id, quantity: 1 }).expect(201);
    await move(housekeeping.auth, { type: 'PURCHASE', itemId: item.id, quantity: 1 }).expect(403);
    await move(housekeeping.auth, { type: 'LOSS', itemId: item.id, quantity: 1 }).expect(403);
    await move(housekeeping.auth, { type: 'DISPOSAL', itemId: item.id, quantity: 1 }).expect(403);
    await request(app).post('/api/inventory/items').set(housekeeping.auth).send({ name: 'Autre', categoryId: category.id }).expect(403);
  });

  it('masque coûts et valeur sans la permission inventory.view_value', async () => {
    const manager = await createStaff('MANAGER');
    const gerant = await createStaff('GERANT');
    const category = await createCategory(manager.auth);
    const item = await createItem(manager.auth, category.id, { initialQuantity: 4, unitCost: 25_000 });

    const asManager = await request(app).get(`/api/inventory/items/${item.id}`).set(manager.auth).expect(200);
    const asGerant = await request(app).get(`/api/inventory/items/${item.id}`).set(gerant.auth).expect(200);

    expect(asManager.body).toEqual(expect.objectContaining({ unitCost: 25_000, value: 100_000 }));
    expect(asGerant.body).toEqual(expect.objectContaining({ unitCost: null, value: null }));
  });

  it('refuse deux articles racines homonymes, sans tenir compte de la casse', async () => {
    const { auth } = await createStaff('MANAGER');
    const category = await createCategory(auth);
    await createItem(auth, category.id, { name: 'Drap 2 places' });

    const res = await request(app).post('/api/inventory/items').set(auth).send({ name: 'drap 2 PLACES', categoryId: category.id });

    expect(res.status).toBe(409);
  });

  it('refuse de désactiver un article qui a encore une quantité', async () => {
    const { auth } = await createStaff('MANAGER');
    const category = await createCategory(auth);
    const item = await createItem(auth, category.id, { initialQuantity: 3 });

    await request(app).patch(`/api/inventory/items/${item.id}`).set(auth).send({ isActive: false }).expect(409);
    await move(auth, { type: 'DISPOSAL', itemId: item.id, quantity: 3 }).expect(201);
    await request(app).patch(`/api/inventory/items/${item.id}`).set(auth).send({ isActive: false }).expect(200);
    await move(auth, { type: 'PURCHASE', itemId: item.id, quantity: 1 }).expect(409);
  });
});

describe('Inventaire — variantes', () => {
  beforeEach(resetDb);

  it('répartit la quantité existante entre les premières variantes, sans changer le total', async () => {
    const { auth } = await createStaff('MANAGER');
    const category = await createCategory(auth);
    const item = await createItem(auth, category.id, { initialQuantity: 30 });

    const incomplete = await request(app).post(`/api/inventory/items/${item.id}/variants`).set(auth)
      .send({ variants: [{ name: 'rouge', quantity: 20 }, { name: 'blanc', quantity: 5 }] });
    expect(incomplete.status).toBe(400);

    const res = await request(app).post(`/api/inventory/items/${item.id}/variants`).set(auth)
      .send({ variants: [{ name: 'rouge', quantity: 20 }, { name: 'blanc', quantity: 10 }] }).expect(201);

    expect(res.body.quantity).toBe(30);
    expect(res.body.hasVariants).toBe(true);
    expect(res.body.variants.map((v: { displayName: string; quantity: number }) => [v.displayName, v.quantity]))
      .toEqual([['Drap 2 places — blanc', 10], ['Drap 2 places — rouge', 20]]);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).quantity).toBe(0);

    const reclass = await prisma.inventoryMovement.findMany({ where: { type: 'RECLASSIFICATION' } });
    expect(reclass.reduce((sum, m) => sum + m.delta, 0)).toBe(0);
    await expectJournalConsistent();
  });

  it('donne une quantité de départ aux variantes ajoutées ensuite', async () => {
    const { auth } = await createStaff('MANAGER');
    const category = await createCategory(auth);
    const item = await createItem(auth, category.id, { initialQuantity: 5 });
    await request(app).post(`/api/inventory/items/${item.id}/variants`).set(auth).send({ variants: [{ name: 'rouge', quantity: 5 }] }).expect(201);

    const res = await request(app).post(`/api/inventory/items/${item.id}/variants`).set(auth)
      .send({ variants: [{ name: 'bleu', quantity: 8 }] }).expect(201);

    expect(res.body.quantity).toBe(13);
    const bleu = await prisma.inventoryItem.findFirstOrThrow({ where: { name: 'bleu' }, include: { movements: true } });
    expect(bleu.movements).toEqual([expect.objectContaining({ type: 'INITIAL', delta: 8 })]);
  });

  it('refuse un mouvement sur un article parent et une variante de variante', async () => {
    const { auth } = await createStaff('MANAGER');
    const category = await createCategory(auth);
    const item = await createItem(auth, category.id);
    const res = await request(app).post(`/api/inventory/items/${item.id}/variants`).set(auth)
      .send({ variants: [{ name: 'rouge', quantity: 4 }] }).expect(201);
    const rouge = res.body.variants[0].id as string;

    await move(auth, { type: 'CONSUMPTION', itemId: item.id, quantity: 1 }).expect(400);
    await move(auth, { type: 'CONSUMPTION', itemId: rouge, quantity: 1 }).expect(201);
    await request(app).post(`/api/inventory/items/${rouge}/variants`).set(auth).send({ variants: [{ name: 'foncé' }] }).expect(400);
  });

  it('autorise le même nom de variante sous deux articles, pas deux fois sous le même', async () => {
    const { auth } = await createStaff('MANAGER');
    const category = await createCategory(auth);
    const drap = await createItem(auth, category.id, { name: 'Drap' });
    const serviette = await createItem(auth, category.id, { name: 'Serviette' });

    await request(app).post(`/api/inventory/items/${drap.id}/variants`).set(auth).send({ variants: [{ name: 'rouge' }] }).expect(201);
    await request(app).post(`/api/inventory/items/${serviette.id}/variants`).set(auth).send({ variants: [{ name: 'rouge' }] }).expect(201);
    await request(app).post(`/api/inventory/items/${drap.id}/variants`).set(auth).send({ variants: [{ name: 'ROUGE' }] }).expect(409);
  });

  it('signale « à racheter » sur le total du parent et sur chaque variante', async () => {
    const { auth } = await createStaff('MANAGER');
    const category = await createCategory(auth);
    const drap = await createItem(auth, category.id, { name: 'Drap', minStock: 40 });
    await request(app).post(`/api/inventory/items/${drap.id}/variants`).set(auth)
      .send({ variants: [{ name: 'rouge', quantity: 20, minStock: 5 }, { name: 'blanc', quantity: 3, minStock: 10 }] }).expect(201);
    await createItem(auth, category.id, { name: 'Nappe', initialQuantity: 50, minStock: 10 });

    const res = await request(app).get('/api/inventory/items?belowMin=true').set(auth).expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual(expect.objectContaining({ name: 'Drap', quantity: 23, isBelowMin: true, hasVariantBelowMin: true }));
    const flags = Object.fromEntries(res.body[0].variants.map((v: { name: string; isBelowMin: boolean }) => [v.name, v.isBelowMin]));
    expect(flags).toEqual({ blanc: true, rouge: false });
  });

  it('désactive un parent avec ses variantes seulement quand elles sont toutes à zéro', async () => {
    const { auth } = await createStaff('MANAGER');
    const category = await createCategory(auth);
    const drap = await createItem(auth, category.id, { name: 'Drap' });
    const res = await request(app).post(`/api/inventory/items/${drap.id}/variants`).set(auth)
      .send({ variants: [{ name: 'rouge', quantity: 2 }] }).expect(201);

    await request(app).patch(`/api/inventory/items/${drap.id}`).set(auth).send({ isActive: false }).expect(409);
    await move(auth, { type: 'LOSS', itemId: res.body.variants[0].id, quantity: 2 }).expect(201);
    await request(app).patch(`/api/inventory/items/${drap.id}`).set(auth).send({ isActive: false }).expect(200);

    const variants = await prisma.inventoryItem.findMany({ where: { parentId: drap.id } });
    expect(variants.every(v => !v.isActive)).toBe(true);
  });

  it('le journal d’un parent regroupe les mouvements de ses variantes', async () => {
    const { auth } = await createStaff('MANAGER');
    const category = await createCategory(auth);
    const drap = await createItem(auth, category.id, { name: 'Drap' });
    const res = await request(app).post(`/api/inventory/items/${drap.id}/variants`).set(auth)
      .send({ variants: [{ name: 'rouge', quantity: 2 }, { name: 'blanc', quantity: 3 }] }).expect(201);
    await move(auth, { type: 'CONSUMPTION', itemId: res.body.variants[0].id, quantity: 1 }).expect(201);

    const journal = await request(app).get(`/api/inventory/movements?itemId=${drap.id}`).set(auth).expect(200);

    expect(journal.body.meta.total).toBe(3);
    expect(journal.body.data[0].item.name).toMatch(/^Drap — /);
  });
});
