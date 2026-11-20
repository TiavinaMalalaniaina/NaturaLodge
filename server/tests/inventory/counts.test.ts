import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { prisma, resetDb } from '../helpers/db';
import { createStaff } from '../helpers/factories';

type Auth = { Authorization: string };

async function setup() {
  const manager = await createStaff('MANAGER');
  const category = (await request(app).post('/api/inventory/categories').set(manager.auth)
    .send({ name: 'Linge', family: 'LINEN_TABLEWARE' }).expect(201)).body as { id: string };
  const item = async (name: string, initialQuantity: number, unitCost?: number) =>
    (await request(app).post('/api/inventory/items').set(manager.auth)
      .send({ name, categoryId: category.id, initialQuantity, unitCost }).expect(201)).body as { id: string };
  return { manager, item };
}

const openCount = (auth: Auth) => request(app).post('/api/inventory/counts').set(auth);
const record = (auth: Auth, countId: string, lines: { itemId: string; countedQty: number | null }[]) =>
  request(app).patch(`/api/inventory/counts/${countId}/lines`).set(auth).send({ lines });

describe('Inventaires (comptages)', () => {
  beforeEach(resetDb);

  it('ouvre un inventaire sur les articles mouvementables, avec la quantité théorique', async () => {
    const { manager, item } = await setup();
    const nappe = await item('Nappe', 12);
    const drap = await item('Drap', 0);
    await request(app).post(`/api/inventory/items/${drap.id}/variants`).set(manager.auth)
      .send({ variants: [{ name: 'rouge', quantity: 4 }, { name: 'blanc', quantity: 6 }] }).expect(201);

    const res = await openCount(manager.auth).expect(201);

    expect(res.body.number).toMatch(/^INV-\d{4}-0001$/);
    expect(res.body.status).toBe('IN_PROGRESS');
    expect(res.body.gapValue).toBe(0);
    const lines = Object.fromEntries(res.body.lines.map((l: { name: string; expectedQty: number }) => [l.name, l.expectedQty]));
    expect(lines).toEqual({ 'Drap — blanc': 6, 'Drap — rouge': 4, Nappe: 12 });
    expect(res.body.lines.map((l: { itemId: string }) => l.itemId)).not.toContain(drap.id);
    expect(res.body.lines.map((l: { itemId: string }) => l.itemId)).toContain(nappe.id);
  });

  it('refuse un second inventaire tant que le premier est en cours', async () => {
    const { manager, item } = await setup();
    await item('Nappe', 3);
    await openCount(manager.auth).expect(201);

    const second = await openCount(manager.auth);

    expect(second.status).toBe(409);
  });

  it('valide : ramène chaque article compté à la quantité comptée, ignore les lignes non comptées', async () => {
    const { manager, item } = await setup();
    const nappe = await item('Nappe', 12, 10_000);
    const serviette = await item('Serviette', 20);
    const count = (await openCount(manager.auth).expect(201)).body;

    await record(manager.auth, count.id, [{ itemId: nappe.id, countedQty: 9 }]).expect(200);
    const res = await request(app).post(`/api/inventory/counts/${count.id}/validate`).set(manager.auth).expect(200);

    expect(res.body.status).toBe('VALIDATED');
    expect(res.body.gapValue).toBe(-30_000);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: nappe.id } })).quantity).toBe(9);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: serviette.id } })).quantity).toBe(20);
    const adjustments = await prisma.inventoryMovement.findMany({ where: { type: 'ADJUSTMENT' } });
    expect(adjustments).toEqual([expect.objectContaining({ itemId: nappe.id, delta: -3, countId: count.id })]);
  });

  it('calcule l’écart sur la quantité au moment de la validation, et signale un mouvement postérieur au comptage', async () => {
    const { manager, item } = await setup();
    const nappe = await item('Nappe', 10);
    const count = (await openCount(manager.auth).expect(201)).body;

    await record(manager.auth, count.id, [{ itemId: nappe.id, countedQty: 8 }]).expect(200);
    await request(app).post('/api/inventory/movements').set(manager.auth)
      .send({ type: 'CONSUMPTION', itemId: nappe.id, quantity: 1 }).expect(201);
    const before = await request(app).get(`/api/inventory/counts/${count.id}`).set(manager.auth).expect(200);
    expect(before.body.lines[0]).toEqual(expect.objectContaining({ currentQty: 9, gap: -1, movedSinceCount: true }));

    await request(app).post(`/api/inventory/counts/${count.id}/validate`).set(manager.auth).expect(200);

    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: nappe.id } })).quantity).toBe(8);
  });

  it('refuse toute saisie ou nouvelle validation après validation, et après annulation', async () => {
    const { manager, item } = await setup();
    const nappe = await item('Nappe', 5);
    const first = (await openCount(manager.auth).expect(201)).body;
    await request(app).post(`/api/inventory/counts/${first.id}/validate`).set(manager.auth).expect(200);

    await request(app).post(`/api/inventory/counts/${first.id}/validate`).set(manager.auth).expect(409);
    await record(manager.auth, first.id, [{ itemId: nappe.id, countedQty: 1 }]).expect(409);

    const second = (await openCount(manager.auth).expect(201)).body;
    await request(app).post(`/api/inventory/counts/${second.id}/cancel`).set(manager.auth).expect(200);
    await record(manager.auth, second.id, [{ itemId: nappe.id, countedQty: 1 }]).expect(409);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: nappe.id } })).quantity).toBe(5);
  });

  it('sous concurrence, un inventaire n’est validé qu’une fois', async () => {
    const { manager, item } = await setup();
    const nappe = await item('Nappe', 10);
    const count = (await openCount(manager.auth).expect(201)).body;
    await record(manager.auth, count.id, [{ itemId: nappe.id, countedQty: 7 }]).expect(200);

    const responses = await Promise.all(Array.from({ length: 4 }, () =>
      request(app).post(`/api/inventory/counts/${count.id}/validate`).set(manager.auth)));

    expect(responses.filter(r => r.status === 200)).toHaveLength(1);
    expect(responses.filter(r => r.status === 409)).toHaveLength(3);
    expect(await prisma.inventoryMovement.count({ where: { type: 'ADJUSTMENT' } })).toBe(1);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: nappe.id } })).quantity).toBe(7);
  });

  it('HOUSEKEEPING compte mais n’ouvre ni ne valide un inventaire', async () => {
    const { manager, item } = await setup();
    const housekeeping = await createStaff('HOUSEKEEPING');
    const nappe = await item('Nappe', 4);

    await openCount(housekeeping.auth).expect(403);
    const count = (await openCount(manager.auth).expect(201)).body;
    await record(housekeeping.auth, count.id, [{ itemId: nappe.id, countedQty: 4 }]).expect(200);
    await request(app).post(`/api/inventory/counts/${count.id}/validate`).set(housekeeping.auth).expect(403);

    const line = await prisma.inventoryCountLine.findFirstOrThrow({ where: { countId: count.id } });
    expect(line.countedById).toBe(housekeeping.user.id);
  });

  it('ignore à la validation un article devenu parent depuis l’ouverture', async () => {
    const { manager, item } = await setup();
    const drap = await item('Drap', 5);
    const count = (await openCount(manager.auth).expect(201)).body;
    await record(manager.auth, count.id, [{ itemId: drap.id, countedQty: 2 }]).expect(200);
    await request(app).post(`/api/inventory/items/${drap.id}/variants`).set(manager.auth)
      .send({ variants: [{ name: 'rouge', quantity: 5 }] }).expect(201);

    const res = await request(app).post(`/api/inventory/counts/${count.id}/validate`).set(manager.auth).expect(200);

    expect(res.body.lines[0]).toEqual(expect.objectContaining({ ignored: true, gap: null }));
    expect(await prisma.inventoryMovement.count({ where: { type: 'ADJUSTMENT' } })).toBe(0);
  });
});
