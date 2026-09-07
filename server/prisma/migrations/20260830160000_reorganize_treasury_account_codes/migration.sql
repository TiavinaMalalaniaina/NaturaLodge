-- Sépare "Banques" et "Mobile Money" en deux familles de code distinctes (512 vs 517) au lieu de
-- partager toutes les deux le préfixe "512" — le regroupement automatique des rapports
-- (getBalanceSheet/getIncomeStatement, voir groupByCodePrefix dans ledger.service.ts) dérive ses
-- en-têtes du préfixe de code, donc les mélanger produisait un seul groupe "512" fourre-tout.
-- Pure donnée (aucune structure ni référence en dur ne dépend de ces codes précis — les comptes de
-- trésorerie sont toujours référencés par id, jamais par code littéral), donc sans risque.
-- Ordre important : libérer 512100/512200 (Mvola/Orange Money) avant d'y déplacer les banques.
UPDATE "LedgerAccount" SET code = '517100' WHERE code = '512100'; -- Mobile Money — Mvola
UPDATE "LedgerAccount" SET code = '517200' WHERE code = '512200'; -- Mobile Money — Orange Money 0323763499
UPDATE "LedgerAccount" SET code = '517300' WHERE code = '512300'; -- Mobile Money — Orange Money 0323762757
UPDATE "LedgerAccount" SET code = '512100' WHERE code = '512400'; -- Banque BMOI
UPDATE "LedgerAccount" SET code = '512200' WHERE code = '512500'; -- Banque BNI
