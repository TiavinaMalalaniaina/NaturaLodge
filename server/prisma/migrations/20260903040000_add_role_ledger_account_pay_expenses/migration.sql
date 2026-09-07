-- Ajoute la capacité, par rôle et par compte de trésorerie, de payer une dépense depuis ce compte.
-- Même logique de fallback que canTransferFrom/canTransferTo : si un rôle n'a aucune ligne
-- canPayExpenses cochée, tout compte visible convient. Voir lib/treasuryAccess.ts.

-- AlterTable
ALTER TABLE "RoleLedgerAccount" ADD COLUMN "canPayExpenses" BOOLEAN NOT NULL DEFAULT false;
