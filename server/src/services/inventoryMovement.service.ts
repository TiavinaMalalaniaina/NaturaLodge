import { InventoryMovementType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/AppError';
import { CreateInventoryMovementInput, InventoryMovementListParams, ManualMovementType } from '../validation/inventory.schema';

// Seul module qui modifie InventoryItem.quantity : chaque variation passe par applyDelta(), qui
// verrouille l'article, vérifie que la quantité ne devient pas négative et écrit le mouvement
// dans la même transaction. Ainsi la quantité reste égale à la somme des deltas du journal.

const OUTGOING: ReadonlySet<ManualMovementType> = new Set(['CONSUMPTION', 'BREAKAGE', 'LOSS', 'DISPOSAL']);

// Permission requise pour saisir chaque type de mouvement (vérifiée par la route).
export const PERMISSION_BY_TYPE: Record<ManualMovementType, string> = {
  PURCHASE:    'inventory.receive',
  CONSUMPTION: 'inventory.record_usage',
  BREAKAGE:    'inventory.record_usage',
  LOSS:        'inventory.dispose',
  DISPOSAL:    'inventory.dispose',
};

type ApplyDeltaParams = {
  type:         InventoryMovementType;
  delta:        number;
  createdById:  string;
  unitCost?:    number | null;
  reason?:      string;
  expenseId?:   string | null;
  bookingId?:   string | null;
  countId?:     string | null;
};

// Verrouille les articles dans l'ordre des ids : deux transactions qui touchent les mêmes
// articles (répartition en variantes, mouvements simultanés) s'attendent sans s'interbloquer.
export async function lockItems(tx: Prisma.TransactionClient, ids: string[]): Promise<void> {
  const sorted = [...new Set(ids)].sort();
  if (!sorted.length) return;
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "InventoryItem" WHERE "id" IN (${Prisma.join(sorted)}) ORDER BY "id" FOR UPDATE`);
}

// L'appelant doit avoir verrouillé l'article (lockItems) dans la même transaction.
export async function applyDelta(tx: Prisma.TransactionClient, itemId: string, params: ApplyDeltaParams) {
  const item = await tx.inventoryItem.findUnique({ where: { id: itemId }, select: { quantity: true, unit: true } });
  if (!item) throw new NotFoundError('Article');

  const quantityAfter = item.quantity + params.delta;
  if (quantityAfter < 0) {
    throw new ConflictError(`Quantité insuffisante : il reste ${item.quantity} ${item.unit}.`);
  }

  await tx.inventoryItem.update({
    where: { id: itemId },
    data: {
      quantity: quantityAfter,
      ...(params.type === 'PURCHASE' && params.unitCost != null ? { unitCost: params.unitCost } : {}),
    },
  });

  return tx.inventoryMovement.create({
    data: {
      type:          params.type,
      itemId,
      delta:         params.delta,
      quantityAfter,
      unitCost:      params.unitCost ?? null,
      reason:        params.reason ?? '',
      expenseId:     params.expenseId ?? null,
      bookingId:     params.bookingId ?? null,
      countId:       params.countId ?? null,
      createdById:   params.createdById,
    },
  });
}

const movementInclude = {
  item:      { select: { id: true, name: true, unit: true, parent: { select: { id: true, name: true } } } },
  createdBy: { select: { id: true, name: true } },
  expense:   { select: { id: true, description: true } },
  booking:   { select: { id: true, guest: { select: { name: true } } } },
  count:     { select: { id: true, number: true } },
} satisfies Prisma.InventoryMovementInclude;

type MovementRow = Prisma.InventoryMovementGetPayload<{ include: typeof movementInclude }>;

export function displayName(item: { name: string; parent: { name: string } | null }): string {
  return item.parent ? `${item.parent.name} — ${item.name}` : item.name;
}

function present(row: MovementRow, canSeeValue: boolean) {
  return {
    id:            row.id,
    type:          row.type,
    delta:         row.delta,
    quantityAfter: row.quantityAfter,
    unitCost:      canSeeValue ? row.unitCost : null,
    reason:        row.reason,
    createdAt:     row.createdAt,
    item:          { id: row.item.id, name: displayName(row.item), unit: row.item.unit },
    createdBy:     row.createdBy,
    expense:       row.expense,
    booking:       row.booking ? { id: row.booking.id, guestName: row.booking.guest.name } : null,
    count:         row.count,
  };
}

export async function record(input: CreateInventoryMovementInput, createdById: string, canSeeValue: boolean) {
  const expenseId = input.type === 'PURCHASE' ? input.expenseId : undefined;
  const bookingId = input.type === 'BREAKAGE' || input.type === 'LOSS' ? input.bookingId : undefined;
  const unitCost  = input.type === 'PURCHASE' ? input.unitCost : undefined;

  const movement = await prisma.$transaction(async (tx) => {
    await lockItems(tx, [input.itemId]);
    const item = await tx.inventoryItem.findUnique({
      where:  { id: input.itemId },
      select: { isActive: true, _count: { select: { variants: { where: { isActive: true } } } } },
    });
    if (!item)                 throw new NotFoundError('Article');
    if (!item.isActive)        throw new ConflictError('Cet article est désactivé.');
    if (item._count.variants)  throw new BadRequestError('Cet article a des variantes : choisissez la variante concernée.');

    if (expenseId && !(await tx.expense.findUnique({ where: { id: expenseId }, select: { id: true } }))) {
      throw new NotFoundError('Dépense');
    }
    if (bookingId && !(await tx.booking.findUnique({ where: { id: bookingId }, select: { id: true } }))) {
      throw new NotFoundError('Réservation');
    }

    const created = await applyDelta(tx, input.itemId, {
      type:  input.type,
      delta: OUTGOING.has(input.type) ? -input.quantity : input.quantity,
      createdById, unitCost, expenseId, bookingId,
      reason: input.reason,
    });
    return tx.inventoryMovement.findUniqueOrThrow({ where: { id: created.id }, include: movementInclude });
  });

  return present(movement, canSeeValue);
}

export async function list(params: InventoryMovementListParams, canSeeValue: boolean) {
  const { page, limit, itemId, type, dateFrom, dateTo } = params;

  // Le journal d'un article parent regroupe ceux de ses variantes.
  const where: Prisma.InventoryMovementWhereInput = {
    ...(itemId ? { OR: [{ itemId }, { item: { parentId: itemId } }] } : {}),
    ...(type ? { type } : {}),
    ...(dateFrom || dateTo ? {
      createdAt: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo   ? { lte: new Date(dateTo) }   : {}),
      },
    } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where, include: movementInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit, take: limit,
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  return {
    data: rows.map(r => present(r, canSeeValue)),
    meta: {
      total, page, limit,
      totalPages:  Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}
