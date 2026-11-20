-- Inventaire global des biens de l'hôtel (docs/conception/INVENTAIRE.md).
-- CreateEnum
CREATE TYPE "InventoryFamily" AS ENUM ('EQUIPMENT', 'LINEN_TABLEWARE', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('INITIAL', 'PURCHASE', 'CONSUMPTION', 'BREAKAGE', 'LOSS', 'DISPOSAL', 'ADJUSTMENT', 'RECLASSIFICATION');

-- CreateTable
CREATE TABLE "InventoryCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" "InventoryFamily" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pièce',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER,
    "unitCost" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "unitCost" INTEGER,
    "reason" TEXT NOT NULL DEFAULT '',
    "expenseId" TEXT,
    "bookingId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_name_key" ON "InventoryCategory"("name");

-- CreateIndex
CREATE INDEX "InventoryItem_parentId_idx" ON "InventoryItem"("parentId");

-- CreateIndex
CREATE INDEX "InventoryItem_categoryId_idx" ON "InventoryItem"("categoryId");

-- CreateIndex
CREATE INDEX "InventoryMovement_itemId_createdAt_idx" ON "InventoryMovement"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_type_createdAt_idx" ON "InventoryMovement"("type", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Invariants que Prisma ne sait pas décrire (ignorés par migrate diff, jamais supprimés).
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_quantity_check" CHECK ("quantity" >= 0);
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_minStock_check" CHECK ("minStock" IS NULL OR "minStock" >= 0);
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_unitCost_check" CHECK ("unitCost" IS NULL OR "unitCost" >= 0);
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_not_own_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id");
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_delta_check" CHECK ("delta" <> 0);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_quantityAfter_check" CHECK ("quantityAfter" >= 0);

-- Permissions de l'inventaire. Idempotent : prisma/seedPermissions.ts déclare les mêmes.
INSERT INTO "Permission" ("id", "key", "domain", "description") VALUES
  (md5(random()::text || clock_timestamp()::text || '1'), 'inventory.view',           'inventory', 'Consulter les articles de l''inventaire, leurs quantités et le journal des mouvements'),
  (md5(random()::text || clock_timestamp()::text || '2'), 'inventory.record_usage',   'inventory', 'Déclarer une consommation ou une casse'),
  (md5(random()::text || clock_timestamp()::text || '3'), 'inventory.receive',        'inventory', 'Enregistrer une entrée d''achat dans l''inventaire'),
  (md5(random()::text || clock_timestamp()::text || '4'), 'inventory.dispose',        'inventory', 'Déclarer une perte ou une mise au rebut'),
  (md5(random()::text || clock_timestamp()::text || '5'), 'inventory.manage_catalog', 'inventory', 'Gérer les catégories, articles, variantes et seuils de l''inventaire'),
  (md5(random()::text || clock_timestamp()::text || '6'), 'inventory.view_value',     'inventory', 'Voir les coûts et la valeur de l''inventaire')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text || r."id" || p."id"), r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON
     (p."key" IN ('inventory.view', 'inventory.record_usage') AND r."name" IN ('ADMIN', 'MANAGER', 'GERANT', 'HOUSEKEEPING'))
  OR (p."key" = 'inventory.receive' AND r."name" IN ('ADMIN', 'MANAGER', 'GERANT'))
  OR (p."key" IN ('inventory.dispose', 'inventory.manage_catalog', 'inventory.view_value') AND r."name" IN ('ADMIN', 'MANAGER'))
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
