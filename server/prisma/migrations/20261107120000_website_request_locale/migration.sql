CREATE TYPE "WebsiteLocale" AS ENUM ('FR', 'EN');
ALTER TABLE "WebsiteRequest" ADD COLUMN "locale" "WebsiteLocale" NOT NULL DEFAULT 'FR';
