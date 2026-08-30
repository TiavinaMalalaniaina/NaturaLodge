-- Remplace l'enum figé ExpenseCategory par une table configurable (ADMIN peut créer/renommer/
-- désactiver des catégories sans redéploiement, chacune liée à un compte de charge précis).
-- Le nom "ExpenseCategory" est repris par la nouvelle table : on doit d'abord libérer ce nom en
-- renommant l'ancien type enum, sinon CREATE TABLE entre en collision avec lui.
ALTER TYPE "ExpenseCategory" RENAME TO "ExpenseCategory_old";

-- 1) Nouvelle table
CREATE TABLE "ExpenseCategory" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");
CREATE INDEX "ExpenseCategory_accountId_idx" ON "ExpenseCategory"("accountId");

ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) Une catégorie par valeur d'enum historique, reprenant le compte déjà utilisé pour cette
-- catégorie (voir l'ancien EXPENSE_ACCOUNT_CODE codé en dur dans expense.service.ts) — pas de
-- perte d'information, juste rendu éditable.
INSERT INTO "ExpenseCategory" ("id", "name", "accountId", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text), v.name, la.id, CURRENT_TIMESTAMP
FROM (VALUES
    ('SUPPLIES',    'Fournitures',                '606100'),
    ('UTILITIES',   'Eau, électricité',           '606200'),
    ('MAINTENANCE', 'Entretien et réparations',   '615000'),
    ('MARKETING',   'Publicité, marketing',       '623000'),
    ('SALARIES',    'Rémunérations du personnel', '641000'),
    ('OTHER',       'Autres charges',             '628000')
) AS v("oldKey", "name", "code")
JOIN "LedgerAccount" la ON la.code = v.code;

-- 3) Nouvelle colonne FK sur Expense, backfillée depuis l'ancienne colonne enum, puis requise
ALTER TABLE "Expense" ADD COLUMN "categoryId" TEXT;

UPDATE "Expense" e
SET "categoryId" = ec.id
FROM (VALUES
    ('SUPPLIES',    'Fournitures'),
    ('UTILITIES',   'Eau, électricité'),
    ('MAINTENANCE', 'Entretien et réparations'),
    ('MARKETING',   'Publicité, marketing'),
    ('SALARIES',    'Rémunérations du personnel'),
    ('OTHER',       'Autres charges')
) AS m("oldKey", "name")
JOIN "ExpenseCategory" ec ON ec.name = m.name
WHERE e."category"::text = m."oldKey";

ALTER TABLE "Expense" ALTER COLUMN "categoryId" SET NOT NULL;
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4) Nettoyage : ancienne colonne enum + type devenus inutiles
ALTER TABLE "Expense" DROP COLUMN "category";
DROP TYPE "ExpenseCategory_old";
