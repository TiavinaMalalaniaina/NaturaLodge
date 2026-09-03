-- Remises sur facture. `discountRate` (1–100) porté par une ligne InvoiceItem MANUAL dont le
-- `total` négatif est recalculé à chaque resynchronisation ; null = montant figé (charge ou remise
-- en montant fixe). Compte de produit dédié `709000` pour isoler les remises accordées du chiffre
-- d'affaires brut au compte de résultat (type REVENUE, solde débiteur = contra-produit).

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN "discountRate" INTEGER;

-- Nouveau compte du plan comptable
INSERT INTO "LedgerAccount" ("id", "code", "name", "type", "updatedAt")
VALUES (md5(random()::text || clock_timestamp()::text), '709000', 'Rabais, remises et ristournes accordés', 'REVENUE', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
