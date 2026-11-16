ALTER TABLE "WebsiteEvent" ADD COLUMN "pushedAt" TIMESTAMP(3);
-- Events recorded before push existed are not sent retroactively.
UPDATE "WebsiteEvent" SET "pushedAt" = CURRENT_TIMESTAMP;
CREATE INDEX "WebsiteEvent_pushedAt_idx" ON "WebsiteEvent"("pushedAt");

CREATE TABLE "StaffPushSubscription" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "StaffPushSubscription_endpoint_key" ON "StaffPushSubscription"("endpoint");
CREATE INDEX "StaffPushSubscription_userId_idx" ON "StaffPushSubscription"("userId");
