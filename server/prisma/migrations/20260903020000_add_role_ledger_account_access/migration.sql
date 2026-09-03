-- Accès par rôle aux comptes de trésorerie : visibilité (liste blanche par rôle) + capacité à
-- utiliser un compte comme source / arrivée d'un virement. Voir lib/treasuryAccess.ts pour les
-- règles. Table vide au départ → comportement inchangé (chaque rôle voit tout, transfère partout)
-- tant que l'administrateur n'a rien configuré depuis l'écran Accès trésorerie.

-- CreateTable
CREATE TABLE "RoleLedgerAccount" (
    "roleId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "canTransferFrom" BOOLEAN NOT NULL DEFAULT false,
    "canTransferTo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleLedgerAccount_pkey" PRIMARY KEY ("roleId","accountId")
);

-- CreateIndex
CREATE INDEX "RoleLedgerAccount_accountId_idx" ON "RoleLedgerAccount"("accountId");

-- AddForeignKey
ALTER TABLE "RoleLedgerAccount" ADD CONSTRAINT "RoleLedgerAccount_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleLedgerAccount" ADD CONSTRAINT "RoleLedgerAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nouvelle permission : court-circuite les restrictions de trésorerie (voit tous les comptes,
-- transfère sans contrainte de source/arrivée). Défaut : ADMIN + MANAGER.
INSERT INTO "Permission" ("id", "key", "domain", "description", "createdAt")
VALUES (md5(random()::text || clock_timestamp()::text), 'ledger.access_all_accounts', 'ledger', 'Voir tous les comptes de trésorerie et transférer sans restriction de compte', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text), r."id", p."id", CURRENT_TIMESTAMP
FROM "Role" r
CROSS JOIN "Permission" p
WHERE p."key" = 'ledger.access_all_accounts' AND r."name" IN ('ADMIN', 'MANAGER')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- HOUSEKEEPING ne voit plus la trésorerie.
DELETE FROM "RolePermission"
WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "name" = 'HOUSEKEEPING')
  AND "permissionId" IN (SELECT "id" FROM "Permission" WHERE "key" = 'ledger.view_cash_accounts');
