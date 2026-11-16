-- A confirmed (or awaiting-payment) website request whose stay is cancelled by the hotel is no longer
-- shown as "REJECTED": it gets its own CANCELLED status.
ALTER TABLE "WebsiteRequest" DROP CONSTRAINT "WebsiteRequest_status_check";
ALTER TABLE "WebsiteRequest" ADD CONSTRAINT "WebsiteRequest_status_check" CHECK ("status" IN ('PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED'));
UPDATE "WebsiteRequest" SET "status" = 'CANCELLED' WHERE "status" = 'REJECTED' AND "bookingId" IS NOT NULL AND "decisionNote" = 'Le séjour a été annulé par l’hôtel.';
