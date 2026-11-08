CREATE TYPE "WebsiteRequestStatus" AS ENUM ('PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED');

ALTER TABLE "WebsiteRequest" DROP CONSTRAINT "WebsiteRequest_status_check";
ALTER TABLE "WebsiteRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "WebsiteRequest" ALTER COLUMN "status" TYPE "WebsiteRequestStatus" USING "status"::"WebsiteRequestStatus";
ALTER TABLE "WebsiteRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "WebsiteEmail" ALTER COLUMN "status" TYPE "WebsiteRequestStatus" USING "status"::"WebsiteRequestStatus";

ALTER TABLE "WebsiteRequest" RENAME COLUMN "accessTokenHash" TO "idempotencyKeyHash";
ALTER INDEX "WebsiteRequest_accessTokenHash_key" RENAME TO "WebsiteRequest_idempotencyKeyHash_key";
