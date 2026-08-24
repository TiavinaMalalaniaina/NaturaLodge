-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "JournalSource" AS ENUM ('INVOICE', 'PAYMENT', 'PAYMENT_VOID', 'EXPENSE', 'TRANSFER', 'MANUAL');

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "isCashAccount" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memo" TEXT,
    "source" "JournalSource" NOT NULL,
    "relatedPaymentId" TEXT,
    "relatedInvoiceId" TEXT,
    "relatedExpenseId" TEXT,
    "postedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" INTEGER NOT NULL DEFAULT 0,
    "credit" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_code_key" ON "LedgerAccount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_number_key" ON "JournalEntry"("number");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- CreateIndex
CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Plan comptable minimal, inséré directement dans la migration (pas seulement via
-- prisma/seedChartOfAccounts.ts) : une base existante avec des paiements historiques doit avoir
-- ces comptes déjà en place au moment où la migration suivante (20260821195859_add_payment_account)
-- rétro-remplit Payment.accountId par code — sinon ce rétro-remplissage échoue silencieusement et
-- l'ALTER COLUMN ... SET NOT NULL qui suit plante sur les lignes non résolues. ON CONFLICT DO
-- NOTHING par sécurité si jamais rejouée, mais la table vient d'être créée, ne devrait jamais matcher.
INSERT INTO "LedgerAccount" ("id", "code", "name", "type", "isCashAccount", "updatedAt") VALUES
  ('acc_101000',  '101000',  'Capital / Apports propriétaire',      'EQUITY',    false, CURRENT_TIMESTAMP),
  ('acc_411000',  '411000',  'Clients',                             'ASSET',     false, CURRENT_TIMESTAMP),
  ('acc_401000',  '401000',  'Fournisseurs',                        'LIABILITY', false, CURRENT_TIMESTAMP),
  ('acc_4457000', '4457000', 'TVA collectée',                       'LIABILITY', false, CURRENT_TIMESTAMP),
  ('acc_4456000', '4456000', 'TVA déductible',                      'ASSET',     false, CURRENT_TIMESTAMP),
  ('acc_530000',  '530000',  'Caisse principale',                   'ASSET',     true,  CURRENT_TIMESTAMP),
  ('acc_512100',  '512100',  'Mobile Money — Mvola',                'ASSET',     true,  CURRENT_TIMESTAMP),
  ('acc_512200',  '512200',  'Mobile Money — Orange Money 0323763499', 'ASSET',     true,  CURRENT_TIMESTAMP),
  ('acc_512300',  '512300',  'Mobile Money — Orange Money 0323762757', 'ASSET',     true,  CURRENT_TIMESTAMP),
  ('acc_606100',  '606100',  'Achats de fournitures',               'EXPENSE',   false, CURRENT_TIMESTAMP),
  ('acc_606200',  '606200',  'Eau, électricité',                    'EXPENSE',   false, CURRENT_TIMESTAMP),
  ('acc_615000',  '615000',  'Entretien et réparations',            'EXPENSE',   false, CURRENT_TIMESTAMP),
  ('acc_623000',  '623000',  'Publicité, marketing',                'EXPENSE',   false, CURRENT_TIMESTAMP),
  ('acc_641000',  '641000',  'Rémunérations du personnel',          'EXPENSE',   false, CURRENT_TIMESTAMP),
  ('acc_628000',  '628000',  'Autres charges',                      'EXPENSE',   false, CURRENT_TIMESTAMP),
  ('acc_706000',  '706000',  'Prestations d''hébergement',          'REVENUE',   false, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
