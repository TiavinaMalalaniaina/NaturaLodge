import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { LOCK_KEYS, lockForTransaction } from '../lib/advisoryLock';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/AppError';
import {
  AddInventoryVariantsInput, CreateInventoryCategoryInput, CreateInventoryItemInput,
  InventoryItemListParams, UpdateInventoryCategoryInput, UpdateInventoryItemInput,
} from '../validation/inventory.schema';
import { applyDelta, lockItems } from './inventoryMovement.service';

// ─── Catégories ──────────────────────────────────────────────────

export function listCategories() {
  return prisma.inventoryCategory.findMany({ orderBy: { name: 'asc' } });
}

export async function createCategory(data: CreateInventoryCategoryInput) {
  const existing = await prisma.inventoryCategory.findFirst({ where: { name: { equals: data.name, mode: 'insensitive' } } });
  if (existing) throw new ConflictError(`Une catégorie nommée « ${existing.name} » existe déjà.`);
  return prisma.inventoryCategory.create({ data });
}

export async function updateCategory(id: string, data: UpdateInventoryCategoryInput) {
  const category = await prisma.inventoryCategory.findUnique({ where: { id } });
  if (!category) throw new NotFoundError('Catégorie');
  if (data.name) {
    const duplicate = await prisma.inventoryCategory.findFirst({ where: { id: { not: id }, name: { equals: data.name, mode: 'insensitive' } } });
    if (duplicate) throw new ConflictError(`Une catégorie nommée « ${duplicate.name} » existe déjà.`);
  }
  if (data.isActive === false) {
    const active = await prisma.inventoryItem.count({ where: { categoryId: id, isActive: true } });
    if (active) throw new ConflictError(`Cette catégorie contient encore ${active} article(s) actif(s).`);
  }
  return prisma.inventoryCategory.update({ where: { id }, data });
}

// ─── Articles ────────────────────────────────────────────────────

const itemInclude = {
  category: { select: { id: true, name: true, family: true } },
  variants: { orderBy: { name: 'asc' } },
} satisfies Prisma.InventoryItemInclude;

type ItemRow = Prisma.InventoryItemGetPayload<{ include: typeof itemInclude }>;
type VariantRow = ItemRow['variants'][number];

const isBelow = (quantity: number, minStock: number | null) => minStock != null && quantity < minStock;

function presentVariant(parent: ItemRow, v: VariantRow, canSeeValue: boolean) {
  return {
    id:          v.id,
    parentId:    parent.id,
    name:        v.name,
    displayName: `${parent.name} — ${v.name}`,
    quantity:    v.quantity,
    minStock:    v.minStock,
    unitCost:    canSeeValue ? (v.unitCost ?? parent.unitCost) : null,
    isActive:    v.isActive,
    isBelowMin:  v.isActive && isBelow(v.quantity, v.minStock),
  };
}

// Un article racine avec ses variantes. `quantity` est le total de l'hôtel : la sienne pour un
// article simple, la somme des variantes actives pour un parent.
function presentItem(item: ItemRow, canSeeValue: boolean, includeInactive: boolean) {
  const activeVariants = item.variants.filter(v => v.isActive);
  const hasVariants = activeVariants.length > 0;
  const quantity = hasVariants ? activeVariants.reduce((sum, v) => sum + v.quantity, 0) : item.quantity;
  const variants = (includeInactive ? item.variants : activeVariants).map(v => presentVariant(item, v, canSeeValue));
  const unitCost = canSeeValue ? item.unitCost : null;
  const value = canSeeValue
    ? (hasVariants
      ? activeVariants.reduce((sum, v) => sum + v.quantity * (v.unitCost ?? item.unitCost ?? 0), 0)
      : item.quantity * (item.unitCost ?? 0))
    : null;

  return {
    id:          item.id,
    parentId:    null,
    name:        item.name,
    displayName: item.name,
    category:    item.category,
    unit:        item.unit,
    quantity,
    minStock:    item.minStock,
    unitCost,
    value,
    isActive:    item.isActive,
    hasVariants,
    isBelowMin:  item.isActive && isBelow(quantity, item.minStock),
    hasVariantBelowMin: variants.some(v => v.isBelowMin),
    variants,
  };
}

export type InventoryItemView = ReturnType<typeof presentItem>;

export async function listItems(params: InventoryItemListParams, canSeeValue: boolean) {
  const includeInactive = params.includeInactive ?? false;
  const search = params.search?.trim();

  const rows = await prisma.inventoryItem.findMany({
    where: {
      parentId: null,
      ...(includeInactive ? {} : { isActive: true }),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.family ? { category: { family: params.family } } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { variants: { some: { name: { contains: search, mode: 'insensitive' } } } },
        ],
      } : {}),
    },
    include: itemInclude,
    orderBy: { name: 'asc' },
  });

  const items = rows.map(r => presentItem(r, canSeeValue, includeInactive));
  return params.belowMin ? items.filter(i => i.isBelowMin || i.hasVariantBelowMin) : items;
}

// Fiche d'un article : pour une variante, renvoie son parent (la fiche est toujours celle du parent).
export async function getItem(id: string, canSeeValue: boolean) {
  const found = await prisma.inventoryItem.findUnique({ where: { id }, select: { parentId: true } });
  if (!found) throw new NotFoundError('Article');
  const root = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: found.parentId ?? id }, include: itemInclude });
  return presentItem(root, canSeeValue, true);
}

// Unicité du nom, insensible à la casse : parmi les articles racines, ou parmi les variantes d'un
// même parent. Vérifiée sous verrou consultatif (création et renommage sont rares) plutôt que par
// un index partiel que Prisma ne sait pas décrire.
async function assertNameAvailable(tx: Prisma.TransactionClient, name: string, parentId: string | null, exceptId?: string) {
  const duplicate = await tx.inventoryItem.findFirst({
    where: { parentId, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { name: true },
  });
  if (duplicate) {
    throw new ConflictError(parentId
      ? `Cet article a déjà une variante « ${duplicate.name} ».`
      : `Un article nommé « ${duplicate.name} » existe déjà.`);
  }
}

async function assertActiveCategory(tx: Prisma.TransactionClient, categoryId: string) {
  const category = await tx.inventoryCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new NotFoundError('Catégorie');
  if (!category.isActive) throw new ConflictError('Cette catégorie est désactivée.');
}

export async function createItem(data: CreateInventoryItemInput, createdById: string, canSeeValue: boolean) {
  const id = await prisma.$transaction(async (tx) => {
    await lockForTransaction(tx, LOCK_KEYS.inventoryCatalog);
    await assertActiveCategory(tx, data.categoryId);
    await assertNameAvailable(tx, data.name, null);

    const item = await tx.inventoryItem.create({
      data: {
        name: data.name, categoryId: data.categoryId, unit: data.unit,
        minStock: data.minStock ?? null, unitCost: data.unitCost ?? null,
      },
    });
    if (data.initialQuantity > 0) {
      await lockItems(tx, [item.id]);
      await applyDelta(tx, item.id, { type: 'INITIAL', delta: data.initialQuantity, createdById, unitCost: data.unitCost });
    }
    return item.id;
  });
  return getItem(id, canSeeValue);
}

export async function updateItem(id: string, data: UpdateInventoryItemInput, canSeeValue: boolean) {
  await prisma.$transaction(async (tx) => {
    await lockForTransaction(tx, LOCK_KEYS.inventoryCatalog);
    const item = await tx.inventoryItem.findUnique({ where: { id }, include: { variants: true, parent: true } });
    if (!item) throw new NotFoundError('Article');

    if (item.parentId && (data.categoryId || data.unit)) {
      throw new BadRequestError('La catégorie et l\'unité d\'une variante suivent celles de son article.');
    }
    if (data.name && data.name.toLowerCase() !== item.name.toLowerCase()) {
      await assertNameAvailable(tx, data.name, item.parentId, id);
    }
    if (data.categoryId && data.categoryId !== item.categoryId) {
      await assertActiveCategory(tx, data.categoryId);
    }

    if (data.isActive === false && item.isActive) {
      if (item.quantity !== 0) {
        throw new ConflictError('Mettez d\'abord la quantité à zéro (perte ou mise au rebut) avant de désactiver cet article.');
      }
      const withStock = item.variants.filter(v => v.isActive && v.quantity !== 0);
      if (withStock.length) {
        throw new ConflictError(`Des variantes ont encore une quantité : ${withStock.map(v => v.name).join(', ')}.`);
      }
      if (item.variants.length) {
        await tx.inventoryItem.updateMany({ where: { parentId: id }, data: { isActive: false } });
      }
    }
    if (data.isActive === true && !item.isActive && item.parent && !item.parent.isActive) {
      throw new ConflictError('Réactivez d\'abord l\'article parent.');
    }

    await tx.inventoryItem.update({ where: { id }, data });
    // Une variante a toujours la catégorie et l'unité de son parent.
    if (!item.parentId && (data.categoryId || data.unit)) {
      await tx.inventoryItem.updateMany({
        where: { parentId: id },
        data:  { ...(data.categoryId ? { categoryId: data.categoryId } : {}), ...(data.unit ? { unit: data.unit } : {}) },
      });
    }
  });
  return getItem(id, canSeeValue);
}

// Ajoute des variantes à un article racine. Si l'article n'avait pas encore de variante active
// mais une quantité, cette quantité doit être entièrement répartie entre les nouvelles variantes
// (mouvements RECLASSIFICATION de somme nulle : le total de l'hôtel ne change pas). Sinon, la
// quantité saisie pour chaque variante est sa quantité de départ (INITIAL).
export async function addVariants(parentId: string, data: AddInventoryVariantsInput, createdById: string, canSeeValue: boolean) {
  await prisma.$transaction(async (tx) => {
    await lockForTransaction(tx, LOCK_KEYS.inventoryCatalog);
    await lockItems(tx, [parentId]);
    const parent = await tx.inventoryItem.findUnique({ where: { id: parentId }, include: { variants: { where: { isActive: true }, select: { id: true } } } });
    if (!parent) throw new NotFoundError('Article');
    if (parent.parentId) throw new BadRequestError('Une variante ne peut pas avoir elle-même de variantes.');
    if (!parent.isActive) throw new ConflictError('Cet article est désactivé.');

    const names = data.variants.map(v => v.name.toLowerCase());
    if (new Set(names).size !== names.length) throw new BadRequestError('Deux variantes portent le même nom.');
    for (const v of data.variants) await assertNameAvailable(tx, v.name, parentId);

    const reclassify = parent.variants.length === 0 && parent.quantity > 0;
    if (reclassify) {
      const distributed = data.variants.reduce((sum, v) => sum + v.quantity, 0);
      if (distributed !== parent.quantity) {
        throw new BadRequestError(`Répartissez les ${parent.quantity} ${parent.unit} existants entre les variantes (${distributed} réparti(s)).`);
      }
      await applyDelta(tx, parentId, {
        type: 'RECLASSIFICATION', delta: -parent.quantity, createdById,
        reason: `Répartition entre ${data.variants.map(v => v.name).join(', ')}`,
      });
    }

    for (const v of data.variants) {
      const variant = await tx.inventoryItem.create({
        data: {
          parentId, name: v.name, categoryId: parent.categoryId, unit: parent.unit,
          minStock: v.minStock ?? null, unitCost: v.unitCost ?? null,
        },
      });
      if (v.quantity > 0) {
        await lockItems(tx, [variant.id]);
        await applyDelta(tx, variant.id, {
          type: reclassify ? 'RECLASSIFICATION' : 'INITIAL', delta: v.quantity, createdById,
          unitCost: v.unitCost ?? parent.unitCost,
          reason: reclassify ? `Répartie depuis ${parent.name}` : '',
        });
      }
    }
  });
  return getItem(parentId, canSeeValue);
}
