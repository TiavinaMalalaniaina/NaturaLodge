-- Avoir d'annulation : frais HT retenus, reclassés de 706000 vers 708500 au visa de l'avoir.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "retainedAmount" INTEGER NOT NULL DEFAULT 0;
