ALTER TABLE "Invoice" ADD COLUMN "appliedToInvoiceId" TEXT;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_appliedToInvoiceId_fkey" FOREIGN KEY ("appliedToInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reprise de l'historique : l'ancien visa d'une facture STANDARD imputait tous les acomptes visés
-- avant lui sur la même réservation (sans regarder leur statut). On rattache exactement ceux-là.
UPDATE "Invoice" AS d
SET "appliedToInvoiceId" = s."id"
FROM "Invoice" AS s
WHERE d."kind" = 'DEPOSIT'
  AND d."validatedAt" IS NOT NULL
  AND d."appliedToInvoiceId" IS NULL
  AND s."bookingId" = d."bookingId"
  AND s."kind" = 'STANDARD'
  AND s."validatedAt" IS NOT NULL
  AND s."validatedAt" >= d."validatedAt";
