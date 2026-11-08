CREATE TABLE "WebsiteRequest" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "accessTokenHash" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "arrival" TIMESTAMP(3) NOT NULL,
  "departure" TIMESTAMP(3) NOT NULL,
  "guests" INTEGER NOT NULL,
  "lines" JSONB NOT NULL,
  "totalAmount" INTEGER NOT NULL,
  "depositAmount" INTEGER NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "paymentInstructions" TEXT NOT NULL DEFAULT '',
  "decisionNote" TEXT NOT NULL DEFAULT '',
  "expiresAt" TIMESTAMP(3),
  "bookingId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebsiteRequest_status_check" CHECK ("status" IN ('PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'REJECTED', 'EXPIRED')),
  CONSTRAINT "WebsiteRequest_dates_check" CHECK ("departure" > "arrival"),
  CONSTRAINT "WebsiteRequest_amounts_check" CHECK ("guests" > 0 AND "depositAmount" > 0 AND "totalAmount" >= "depositAmount")
);
CREATE UNIQUE INDEX "WebsiteRequest_reference_key" ON "WebsiteRequest"("reference");
CREATE UNIQUE INDEX "WebsiteRequest_accessTokenHash_key" ON "WebsiteRequest"("accessTokenHash");
CREATE UNIQUE INDEX "WebsiteRequest_bookingId_key" ON "WebsiteRequest"("bookingId");
CREATE INDEX "WebsiteRequest_status_createdAt_idx" ON "WebsiteRequest"("status", "createdAt");
ALTER TABLE "WebsiteRequest" ADD CONSTRAINT "WebsiteRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
