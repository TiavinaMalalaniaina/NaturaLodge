-- Comptes collectifs supplémentaires pour les niveaux au-dessus de "512"/"517" — "5" (Trésorerie),
-- "51" (Banques et Mobile Money), "53" (Caisse) — voir groupByCodePrefix dans ledger.service.ts.
-- Pas de collectif "4" : il couvrirait à la fois des comptes ASSET (Clients, TVA déductible) et
-- LIABILITY (Fournisseurs, TVA collectée), impossible avec un seul code (unique tous types
-- confondus) — ce groupe reste sans libellé, code brut uniquement.
INSERT INTO "LedgerAccount" ("id", "code", "name", "type", "updatedAt")
VALUES
  (md5(random()::text || clock_timestamp()::text), '5',  'Trésorerie',                'ASSET', CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), '51', 'Banques et Mobile Money',   'ASSET', CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), '53', 'Caisse',                    'ASSET', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
