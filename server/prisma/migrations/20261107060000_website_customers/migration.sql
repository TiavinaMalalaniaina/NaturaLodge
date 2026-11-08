CREATE TABLE "WebsiteCustomer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "WebsiteCustomer_email_key" ON "WebsiteCustomer"("email");
CREATE TABLE "WebsiteLogin" (
  "tokenHash" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "WebsiteLogin_expiresAt_idx" ON "WebsiteLogin"("expiresAt");
CREATE TABLE "WebsiteSession" (
  "tokenHash" TEXT NOT NULL PRIMARY KEY,
  "customerId" TEXT NOT NULL REFERENCES "WebsiteCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "WebsiteSession_expiresAt_idx" ON "WebsiteSession"("expiresAt");
ALTER TABLE "WebsiteRequest" ADD COLUMN "customerId" TEXT;
ALTER TABLE "WebsiteRequest" ADD CONSTRAINT "WebsiteRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "WebsiteCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "WebsiteRequest_customerId_createdAt_idx" ON "WebsiteRequest"("customerId", "createdAt");
