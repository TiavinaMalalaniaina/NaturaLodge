-- Produit constaté quand un acompte encaissé n'est remboursé que partiellement à l'annulation :
-- la part retenue (frais d'annulation) sort du passif 419100 pour devenir du revenu. Voir
-- invoice.service.ts (validateInvoice, branche CREDIT_NOTE sur un acompte) et seedChartOfAccounts.ts.
INSERT INTO "LedgerAccount" ("id", "code", "name", "type", "updatedAt")
VALUES (md5(random()::text || clock_timestamp()::text), '708500', 'Frais d''annulation retenus', 'REVENUE', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
