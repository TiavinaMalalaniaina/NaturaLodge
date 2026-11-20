-- Inventaires (comptages physiques) : lot 2 de docs/conception/INVENTAIRE.md.
-- CreateEnum
CREATE TYPE "InventoryCountStatus" AS ENUM ('IN_PROGRESS', 'VALIDATED', 'CANCELLED');

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "countId" TEXT;

-- CreateTable
CREATE TABLE "InventoryCount" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "InventoryCountStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdById" TEXT,
    "validatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "InventoryCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCountLine" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "expectedQty" INTEGER NOT NULL,
    "countedQty" INTEGER,
    "countedById" TEXT,
    "countedAt" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "quantityAtValidation" INTEGER,
    "adjustment" INTEGER,

    CONSTRAINT "InventoryCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCount_number_key" ON "InventoryCount"("number");

-- CreateIndex
CREATE INDEX "InventoryCount_status_idx" ON "InventoryCount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCountLine_countId_itemId_key" ON "InventoryCountLine"("countId", "itemId");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_countId_fkey" FOREIGN KEY ("countId") REFERENCES "InventoryCount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_countId_fkey" FOREIGN KEY ("countId") REFERENCES "InventoryCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_quantities_check"
  CHECK ("expectedQty" >= 0 AND ("countedQty" IS NULL OR "countedQty" >= 0) AND ("quantityAtValidation" IS NULL OR "quantityAtValidation" >= 0));

-- Permissions des inventaires. Idempotent : prisma/seedPermissions.ts déclare les mêmes.
INSERT INTO "Permission" ("id", "key", "domain", "description") VALUES
  (md5(random()::text || clock_timestamp()::text || '1'), 'inventory.count',          'inventory', 'Saisir des quantités comptées dans un inventaire en cours'),
  (md5(random()::text || clock_timestamp()::text || '2'), 'inventory.validate_count', 'inventory', 'Ouvrir, valider ou annuler un inventaire')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text || r."id" || p."id"), r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON
     (p."key" = 'inventory.count' AND r."name" IN ('ADMIN', 'MANAGER', 'GERANT', 'HOUSEKEEPING'))
  OR (p."key" = 'inventory.validate_count' AND r."name" IN ('ADMIN', 'MANAGER'))
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
