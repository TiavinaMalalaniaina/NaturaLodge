-- Cycle de vie brouillon → visé pour les factures, et documents multiples par réservation
-- (acompte / facture / avoir). Voir invoice.service.ts pour la logique applicative.
--
-- Backfill : toute facture déjà en base est réputée déjà visée (elle est déjà au grand livre) —
-- sans ce backfill elle disparaîtrait silencieusement des vues "documents visés uniquement".

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('STANDARD', 'DEPOSIT', 'CREDIT_NOTE');

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "number" DROP NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN "kind" "InvoiceKind" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "Invoice" ADD COLUMN "validatedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "relatesToInvoiceId" TEXT;

-- Backfill : toutes les factures existantes sont déjà visées, à leur date d'émission actuelle.
UPDATE "Invoice" SET "validatedAt" = "issuedAt" WHERE "validatedAt" IS NULL;

-- CreateIndex
CREATE INDEX "Invoice_bookingId_kind_idx" ON "Invoice"("bookingId", "kind");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_relatesToInvoiceId_fkey" FOREIGN KEY ("relatesToInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
