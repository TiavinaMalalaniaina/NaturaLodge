-- Le staff se connecte désormais par username (email non garanti) ; les clients n'ont pas
-- forcément d'email non plus. username devient obligatoire+unique sur User, email devient
-- facultatif sur User et Guest.

ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Backfill des comptes existants à partir de la partie locale de leur email.
UPDATE "User" SET "username" = split_part("email", '@', 1) WHERE "username" IS NULL;

-- Garantit l'unicité même en cas de collision improbable de local-part entre deux comptes.
UPDATE "User" u SET "username" = u."username" || '_' || u.id
  WHERE EXISTS (SELECT 1 FROM "User" u2 WHERE u2."username" = u."username" AND u2.id <> u.id);

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_username_key" UNIQUE ("username");
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "Guest" ALTER COLUMN "email" DROP NOT NULL;
