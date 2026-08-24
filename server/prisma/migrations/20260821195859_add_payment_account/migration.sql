-- AlterTable: add nullable first, backfill existing rows, then enforce NOT NULL.
ALTER TABLE "Payment" ADD COLUMN     "accountId" TEXT;

-- Backfill: paiements existants (données de démo) mappés sur le compte de trésorerie
-- correspondant à leur méthode. CASH -> Caisse principale, MVOLA -> compte Mvola,
-- ORANGE_MONEY -> premier compte Orange Money (numéro exact inconnu pour l'historique).
-- CARD/BANK_TRANSFER/ONLINE n'ont pas encore de compte bancaire réel : repli sur la Caisse.
UPDATE "Payment" SET "accountId" = (SELECT "id" FROM "LedgerAccount" WHERE "code" = '512100') WHERE "method" = 'MVOLA';
UPDATE "Payment" SET "accountId" = (SELECT "id" FROM "LedgerAccount" WHERE "code" = '512200') WHERE "method" = 'ORANGE_MONEY';
UPDATE "Payment" SET "accountId" = (SELECT "id" FROM "LedgerAccount" WHERE "code" = '530000') WHERE "accountId" IS NULL;

ALTER TABLE "Payment" ALTER COLUMN "accountId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
