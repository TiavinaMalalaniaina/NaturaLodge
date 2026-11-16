CREATE TABLE "WebsitePaymentProof" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "WebsiteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "WebsitePaymentProof_requestId_createdAt_idx" ON "WebsitePaymentProof"("requestId", "createdAt");
-- The free-text template (paymentInstructions.fr/.en) is replaced by a structured payment sheet.
DELETE FROM "WebsiteSetting" WHERE "key" IN ('paymentInstructions.fr', 'paymentInstructions.en');
