-- Permission « trop-perçu » (invoices.overpay), accordée par défaut à ADMIN et MANAGER.
-- Idempotent : le seed (prisma/seedPermissions.ts) déclare la même permission.
INSERT INTO "Permission" ("id", "key", "domain", "description")
VALUES (md5(random()::text || clock_timestamp()::text), 'invoices.overpay', 'invoices', 'Enregistrer un paiement supérieur au reste dû (trop-perçu)')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text || r."id"), r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" IN ('ADMIN', 'MANAGER') AND p."key" = 'invoices.overpay'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
