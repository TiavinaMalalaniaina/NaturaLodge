-- Permission dédiée à la consultation des demandes du site (websiteRequests.view), jusqu'ici couverte
-- par bookings.view (accordée à tous les rôles, y compris HOUSEKEEPING). Accordée par défaut à
-- ADMIN, MANAGER et GERANT. Idempotent : le seed (prisma/seedPermissions.ts) déclare la même permission.
INSERT INTO "Permission" ("id", "key", "domain", "description")
VALUES (md5(random()::text || clock_timestamp()::text), 'websiteRequests.view', 'websiteRequests', 'Consulter les demandes du site (coordonnées clients, preuves de paiement) et en recevoir les notifications')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT md5(random()::text || clock_timestamp()::text || r."id"), r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" IN ('ADMIN', 'MANAGER', 'GERANT') AND p."key" = 'websiteRequests.view'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
