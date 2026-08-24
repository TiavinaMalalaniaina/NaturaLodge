-- AlterTable
ALTER TABLE "LedgerAccount" ADD COLUMN     "allowedMethods" "PaymentMethod"[] DEFAULT ARRAY[]::"PaymentMethod"[];

-- Associe chaque compte de trésorerie à la/les méthode(s) qu'il peut recevoir physiquement — sert
-- à filtrer le sélecteur de compte du formulaire de paiement selon la méthode choisie. Les deux
-- comptes Orange Money restent tous les deux éligibles à ORANGE_MONEY (l'app ne peut pas deviner
-- automatiquement lequel des deux numéros a reçu l'argent, l'utilisateur choisit).
UPDATE "LedgerAccount" SET "allowedMethods" = ARRAY['CASH']::"PaymentMethod"[]         WHERE "code" = '530000';
UPDATE "LedgerAccount" SET "allowedMethods" = ARRAY['MVOLA']::"PaymentMethod"[]        WHERE "code" = '512100';
UPDATE "LedgerAccount" SET "allowedMethods" = ARRAY['ORANGE_MONEY']::"PaymentMethod"[] WHERE "code" IN ('512200', '512300');
