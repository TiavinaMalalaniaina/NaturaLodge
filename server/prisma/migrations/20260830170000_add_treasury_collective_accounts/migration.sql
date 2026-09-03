-- Comptes collectifs "512 Banque" et "517 Mobile Money" : le libellé de groupe des rapports
-- (getBalanceSheet/getIncomeStatement, voir groupByCodePrefix dans ledger.service.ts) est
-- maintenant dérivé d'un vrai compte du plan comptable dont le code correspond exactement au
-- préfixe partagé, plutôt que deviné depuis les noms des sous-comptes — permet de raccourcir les
-- noms des sous-comptes sans perdre le libellé du groupe. Ni l'un ni l'autre ne reçoit jamais
-- d'écriture directement (isCashAccount: false), leur seul rôle est de porter ce libellé.
INSERT INTO "LedgerAccount" ("id", "code", "name", "type", "updatedAt")
VALUES
  (md5(random()::text || clock_timestamp()::text), '512', 'Banque',       'ASSET', CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), '517', 'Mobile Money', 'ASSET', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Noms raccourcis : le libellé du groupe porte déjà "Banque"/"Mobile Money", plus besoin de le
-- répéter dans chaque sous-compte.
UPDATE "LedgerAccount" SET "name" = 'BMOI'                     WHERE "code" = '512100';
UPDATE "LedgerAccount" SET "name" = 'BNI'                      WHERE "code" = '512200';
UPDATE "LedgerAccount" SET "name" = 'Mvola'                    WHERE "code" = '517100';
UPDATE "LedgerAccount" SET "name" = 'Orange Money 0323763499'  WHERE "code" = '517200';
UPDATE "LedgerAccount" SET "name" = 'Orange Money 0323762757'  WHERE "code" = '517300';
