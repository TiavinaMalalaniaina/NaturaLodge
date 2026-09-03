-- Remplace l'enum figé Role par une table configurable (ADMIN peut créer/renommer des rôles sans
-- redéploiement). Même trick que pour ExpenseCategory : on renomme l'ancien type enum pour libérer
-- le nom "Role", avant de créer la table du même nom.
ALTER TYPE "Role" RENAME TO "Role_old";

-- 1) Nouvelle table
CREATE TABLE "Role" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "isSystem"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- 2) Les 4 rôles historiques, marqués isSystem (jamais supprimables, renommables comme les autres)
INSERT INTO "Role" ("id", "name", "isSystem")
SELECT md5(random()::text || clock_timestamp()::text), v.name, true
FROM (VALUES ('ADMIN'), ('MANAGER'), ('GERANT'), ('HOUSEKEEPING')) AS v(name);

-- 3) User.role (enum) -> User.roleId (FK), backfillé puis requis
ALTER TABLE "User" ADD COLUMN "roleId" TEXT;

UPDATE "User" u
SET "roleId" = r.id
FROM "Role" r
WHERE r.name = u."role"::text;

ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;
CREATE INDEX "User_roleId_idx" ON "User"("roleId");
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" DROP COLUMN "role";

-- 4) RolePermission.role (enum) -> RolePermission.roleId (FK), même traitement
ALTER TABLE "RolePermission" ADD COLUMN "roleId" TEXT;

UPDATE "RolePermission" rp
SET "roleId" = r.id
FROM "Role" r
WHERE r.name = rp."role"::text;

ALTER TABLE "RolePermission" ALTER COLUMN "roleId" SET NOT NULL;

DROP INDEX "RolePermission_role_permissionId_key";
DROP INDEX "RolePermission_role_idx";
ALTER TABLE "RolePermission" DROP COLUMN "role";

CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) Nettoyage : ancien type enum devenu inutile
DROP TYPE "Role_old";
