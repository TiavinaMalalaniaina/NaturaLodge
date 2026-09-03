-- Distingue les lignes de facture dérivées de la réservation (BOOKING, réécrites à chaque
-- resynchronisation) des lignes libres ajoutées à la main (MANUAL). Les lignes existantes sont
-- toutes issues de la génération depuis la réservation → défaut BOOKING.

-- CreateEnum
CREATE TYPE "InvoiceItemSource" AS ENUM ('BOOKING', 'MANUAL');

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN "source" "InvoiceItemSource" NOT NULL DEFAULT 'BOOKING';
