import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { LOCK_KEYS, lockForTransaction } from '../lib/advisoryLock';
import { nextDocumentNumber } from '../lib/documentNumber';
import { ConflictError, NotFoundError } from '../errors/AppError';
import { RecordCountLinesInput } from '../validation/inventory.schema';
import { applyDelta, lockItems } from './inventoryMovement.service';

// Inventaire (comptage physique). Ouverture : une ligne par article mouvementable avec sa quantité
// théorique. Saisie : quantités comptées, par plusieurs personnes. Validation : chaque article
// compté est ramené à la quantité comptée par un mouvement ADJUSTMENT, l'écart étant calculé sur
// la quantité au moment de la validation (les mouvements survenus pendant le comptage restent
// dans le journal ; l'écran signale ceux postérieurs au comptage d'une ligne).

const VALIDATION_TIMEOUT_MS = 60_000;

async function lockCount(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "InventoryCount" WHERE "id" = ${id} FOR UPDATE`;
  const count = await tx.inventoryCount.findUnique({ where: { id } });
  if (!count) throw new NotFoundError('Inventaire');
  return count;
}

function assertInProgress(count: { status: string; number: string }) {
  if (count.status === 'VALIDATED') throw new ConflictError(`L'inventaire ${count.number} est déjà validé.`);
  if (count.status === 'CANCELLED') throw new ConflictError(`L'inventaire ${count.number} a été annulé.`);
}

export async function open(createdById: string, canSeeValue: boolean) {
  const id = await prisma.$transaction(async (tx) => {
    await lockForTransaction(tx, LOCK_KEYS.inventoryCount);
    const current = await tx.inventoryCount.findFirst({ where: { status: 'IN_PROGRESS' }, select: { number: true } });
    if (current) throw new ConflictError(`L'inventaire ${current.number} est déjà en cours : validez-le ou annulez-le d'abord.`);

    // Articles mouvementables : les variantes actives et les articles sans variante active.
    const items = await tx.inventoryItem.findMany({
      where: { isActive: true, OR: [{ parentId: { not: null } }, { variants: { none: { isActive: true } } }] },
      select: { id: true, quantity: true },
    });
    if (!items.length) throw new ConflictError('Aucun article actif à compter.');

    const number = await nextDocumentNumber(tx, 'InventoryCount', 'INV', LOCK_KEYS.inventoryCount);
    const count = await tx.inventoryCount.create({ data: { number, createdById } });
    await tx.inventoryCountLine.createMany({
      data: items.map(i => ({ countId: count.id, itemId: i.id, expectedQty: i.quantity })),
    });
    return count.id;
  });
  return get(id, canSeeValue);
}

export async function list() {
  const counts = await prisma.inventoryCount.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy:   { select: { id: true, name: true } },
      validatedBy: { select: { id: true, name: true } },
      lines:       { select: { countedQty: true, adjustment: true } },
    },
  });
  return counts.map(({ lines, ...count }) => ({
    ...count,
    totalLines:   lines.length,
    countedLines: lines.filter(l => l.countedQty != null).length,
    gapLines:     lines.filter(l => l.adjustment != null && l.adjustment !== 0).length,
  }));
}

const lineInclude = {
  item: {
    select: {
      id: true, name: true, unit: true, quantity: true, unitCost: true, isActive: true,
      parent:   { select: { id: true, name: true, unitCost: true } },
      category: { select: { id: true, name: true } },
    },
  },
  countedBy: { select: { id: true, name: true } },
} satisfies Prisma.InventoryCountLineInclude;

export async function get(id: string, canSeeValue: boolean) {
  const count = await prisma.inventoryCount.findUnique({
    where: { id },
    include: {
      createdBy:   { select: { id: true, name: true } },
      validatedBy: { select: { id: true, name: true } },
      lines:       { include: lineInclude },
    },
  });
  if (!count) throw new NotFoundError('Inventaire');
  const inProgress = count.status === 'IN_PROGRESS';

  // Articles mouvementés après avoir été comptés (inventaire en cours seulement).
  const movedAfter = new Map<string, Date>();
  if (inProgress) {
    const countedIds = count.lines.filter(l => l.countedAt).map(l => l.itemId);
    if (countedIds.length) {
      const movements = await prisma.inventoryMovement.findMany({
        where: { itemId: { in: countedIds }, createdAt: { gte: count.createdAt } },
        select: { itemId: true, createdAt: true },
      });
      for (const m of movements) {
        const last = movedAfter.get(m.itemId);
        if (!last || m.createdAt > last) movedAfter.set(m.itemId, m.createdAt);
      }
    }
  }

  const lines = count.lines.map(line => {
    const { item } = line;
    const currentQty = inProgress ? item.quantity : line.quantityAtValidation;
    const gap = inProgress
      ? (line.countedQty != null ? line.countedQty - item.quantity : null)
      : line.adjustment;
    const unitCost = item.unitCost ?? item.parent?.unitCost ?? null;
    const lastMove = movedAfter.get(item.id);
    return {
      id:              line.id,
      itemId:          item.id,
      name:            item.parent ? `${item.parent.name} — ${item.name}` : item.name,
      parentId:        item.parent?.id ?? null,
      parentName:      item.parent?.name ?? null,
      variantName:     item.parent ? item.name : null,
      category:        item.category,
      unit:            item.unit,
      expectedQty:     line.expectedQty,
      currentQty,
      countedQty:      line.countedQty,
      countedBy:       line.countedBy,
      countedAt:       line.countedAt,
      note:            line.note,
      movedSinceCount: !!(lastMove && line.countedAt && lastMove > line.countedAt),
      ignored:         !inProgress && count.status === 'VALIDATED' && line.countedQty != null && line.adjustment == null,
      gap,
      gapValue:        canSeeValue && gap != null && unitCost != null ? gap * unitCost : null,
    };
  }).sort((a, b) => a.category.name.localeCompare(b.category.name) || a.name.localeCompare(b.name));

  return {
    id:           count.id,
    number:       count.number,
    status:       count.status,
    createdBy:    count.createdBy,
    validatedBy:  count.validatedBy,
    createdAt:    count.createdAt,
    validatedAt:  count.validatedAt,
    cancelledAt:  count.cancelledAt,
    totalLines:   lines.length,
    countedLines: lines.filter(l => l.countedQty != null).length,
    gapLines:     lines.filter(l => l.gap != null && l.gap !== 0).length,
    gapValue:     canSeeValue ? lines.reduce((sum, l) => sum + (l.gapValue ?? 0), 0) : null,
    lines,
  };
}

export async function recordLines(id: string, data: RecordCountLinesInput, countedById: string, canSeeValue: boolean) {
  await prisma.$transaction(async (tx) => {
    // Même verrou que la validation : une saisie ne se glisse jamais dans un inventaire en train d'être validé.
    const count = await lockCount(tx, id);
    assertInProgress(count);
    for (const line of data.lines) {
      const updated = await tx.inventoryCountLine.updateMany({
        where: { countId: id, itemId: line.itemId },
        data: line.countedQty == null
          ? { countedQty: null, countedById: null, countedAt: null, ...(line.note != null ? { note: line.note } : {}) }
          : { countedQty: line.countedQty, countedById, countedAt: new Date(), ...(line.note != null ? { note: line.note } : {}) },
      });
      if (!updated.count) throw new NotFoundError('Ligne d\'inventaire');
    }
  });
  return get(id, canSeeValue);
}

export async function validate(id: string, validatedById: string, canSeeValue: boolean) {
  await prisma.$transaction(async (tx) => {
    const count = await lockCount(tx, id);
    assertInProgress(count);

    const lines = await tx.inventoryCountLine.findMany({ where: { countId: id, countedQty: { not: null } } });
    await lockItems(tx, lines.map(l => l.itemId));
    const items = await tx.inventoryItem.findMany({
      where:  { id: { in: lines.map(l => l.itemId) } },
      select: { id: true, quantity: true, isActive: true, _count: { select: { variants: { where: { isActive: true } } } } },
    });
    const itemById = new Map(items.map(i => [i.id, i]));

    for (const line of lines) {
      const item = itemById.get(line.itemId);
      // Désactivé ou devenu parent depuis l'ouverture : ligne ignorée, sans ajustement.
      if (!item || !item.isActive || item._count.variants > 0) continue;
      const adjustment = line.countedQty! - item.quantity;
      if (adjustment !== 0) {
        await applyDelta(tx, item.id, {
          type: 'ADJUSTMENT', delta: adjustment, createdById: validatedById,
          countId: id,
        });
      }
      await tx.inventoryCountLine.update({ where: { id: line.id }, data: { quantityAtValidation: item.quantity, adjustment } });
    }

    await tx.inventoryCount.update({ where: { id }, data: { status: 'VALIDATED', validatedById, validatedAt: new Date() } });
  }, { timeout: VALIDATION_TIMEOUT_MS });
  return get(id, canSeeValue);
}

export async function cancel(id: string, canSeeValue: boolean) {
  await prisma.$transaction(async (tx) => {
    const count = await lockCount(tx, id);
    assertInProgress(count);
    await tx.inventoryCount.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  });
  return get(id, canSeeValue);
}
