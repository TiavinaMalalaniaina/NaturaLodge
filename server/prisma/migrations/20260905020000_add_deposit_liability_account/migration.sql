-- Compte pour les acomptes encaissés avant la prestation : ce n'est pas du chiffre d'affaires tant
-- que le séjour n'a pas eu lieu. Voir seedChartOfAccounts.ts (même compte, pour les nouvelles bases).
INSERT INTO "LedgerAccount" ("id", "code", "name", "type", "updatedAt")
VALUES (md5(random()::text || clock_timestamp()::text), '419100', 'Clients — avances et acomptes reçus', 'LIABILITY', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
