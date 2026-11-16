-- Connexion client par mot de passe ou Google : le lien magique (WebsiteLogin) disparaît.
-- Les comptes existants ont tous un email vérifié (créés par lien magique) : ils se connectent via
-- Google ou définissent un mot de passe avec « Mot de passe oublié ».
ALTER TABLE "WebsiteCustomer" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "WebsiteCustomer" ADD COLUMN "googleId" TEXT;
CREATE UNIQUE INDEX "WebsiteCustomer_googleId_key" ON "WebsiteCustomer"("googleId");

CREATE TYPE "WebsiteTokenPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');
CREATE TABLE "WebsiteEmailToken" (
  "tokenHash" TEXT NOT NULL PRIMARY KEY,
  "purpose" "WebsiteTokenPurpose" NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "WebsiteEmailToken_expiresAt_idx" ON "WebsiteEmailToken"("expiresAt");
CREATE INDEX "WebsiteEmailToken_email_purpose_idx" ON "WebsiteEmailToken"("email", "purpose");

DROP TABLE "WebsiteLogin";
