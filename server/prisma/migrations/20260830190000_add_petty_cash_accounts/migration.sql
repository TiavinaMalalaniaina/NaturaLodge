-- "530" (compte collectif, libellé du groupe "530000 Caisse principale" une fois qu'un deuxième
-- compte partagera ce préfixe) et "531 · Petites caisses et caisses réception" avec son premier
-- compte réel "531100 Petite caisse" — voir getCashAccountGroups/groupByCodePrefix dans
-- ledger.service.ts. D'autres caisses (caisse réception, petite caisse d'un autre service...)
-- peuvent être ajoutées plus tard depuis l'écran Comptes avec un code "531xxx" : elles
-- rejoindront automatiquement ce groupe, sans nouvelle migration.
INSERT INTO "LedgerAccount" ("id", "code", "name", "type", "isCashAccount", "allowedMethods", "updatedAt")
VALUES
  (md5(random()::text || clock_timestamp()::text), '530',    'Caisse principale',                    'ASSET', false, ARRAY[]::"PaymentMethod"[],   CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), '531',    'Petites caisses et caisses réception', 'ASSET', false, ARRAY[]::"PaymentMethod"[],   CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), '531100', 'Petite caisse',                        'ASSET', true,  ARRAY['CASH']::"PaymentMethod"[], CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
