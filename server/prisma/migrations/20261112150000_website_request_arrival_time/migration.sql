-- Heure d'arrivée estimée saisie sur le site (« HH:MM »), vide si non renseignée.
ALTER TABLE "WebsiteRequest" ADD COLUMN IF NOT EXISTS "arrivalTime" TEXT NOT NULL DEFAULT '';
