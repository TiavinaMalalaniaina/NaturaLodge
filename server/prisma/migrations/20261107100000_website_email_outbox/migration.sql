CREATE TABLE "WebsiteEmail" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "WebsiteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "status" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "WebsiteEmail_sentAt_nextAttemptAt_idx" ON "WebsiteEmail"("sentAt", "nextAttemptAt");
CREATE INDEX "WebsiteEmail_requestId_idx" ON "WebsiteEmail"("requestId");
