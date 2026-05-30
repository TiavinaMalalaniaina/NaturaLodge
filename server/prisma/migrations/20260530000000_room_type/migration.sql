-- ─── 1. Create RoomType table ────────────────────────────────────
CREATE TABLE "RoomType" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "category"    "RoomCategory" NOT NULL,
    "rate"        INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "area"        INTEGER NOT NULL DEFAULT 30,
    "bedType"     TEXT NOT NULL DEFAULT 'King Size',
    "capacity"    INTEGER NOT NULL DEFAULT 2,
    "view"        TEXT NOT NULL DEFAULT 'Garden View',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- ─── 2. Create RoomType ↔ RoomFeature junction ────────────────────
-- A = RoomFeature.id, B = RoomType.id (Prisma alphabetical: F < T)
CREATE TABLE "_RoomTypeToFeature" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- ─── 3. Add new columns to Room ──────────────────────────────────
ALTER TABLE "Room" ADD COLUMN "roomTypeId"   TEXT;
ALTER TABLE "Room" ADD COLUMN "rateOverride" INTEGER;

-- ─── 4. Migrate data: create one RoomType per unique (type, category) ─
INSERT INTO "RoomType" (id, name, category, rate, description, area, "bedType", capacity, view, "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    type,
    category,
    MAX(rate),
    MAX(COALESCE(description, '')),
    MAX(area),
    MAX("bedType"),
    MAX(capacity),
    MAX(COALESCE(view, 'Garden View')),
    NOW(),
    NOW()
FROM "Room"
GROUP BY type, category;

-- ─── 5. Link each Room to its RoomType ───────────────────────────
UPDATE "Room" r
SET "roomTypeId" = rt.id
FROM "RoomType" rt
WHERE rt.name = r.type AND rt.category = r.category;

-- ─── 6. Migrate features: Room features → RoomType features ──────
INSERT INTO "_RoomTypeToFeature" ("A", "B")
SELECT DISTINCT rtf."B", rt.id
FROM "Room" r
JOIN "_RoomToFeature" rtf ON rtf."A" = r.id
JOIN "RoomType" rt ON rt.name = r.type AND rt.category = r.category
ON CONFLICT DO NOTHING;

-- ─── 7. Make roomTypeId NOT NULL + FK ────────────────────────────
ALTER TABLE "Room" ALTER COLUMN "roomTypeId" SET NOT NULL;
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey"
    FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 8. Junction table indexes ───────────────────────────────────
CREATE UNIQUE INDEX "_RoomTypeToFeature_AB_unique" ON "_RoomTypeToFeature"("A", "B");
CREATE INDEX "_RoomTypeToFeature_B_index" ON "_RoomTypeToFeature"("B");
ALTER TABLE "_RoomTypeToFeature" ADD CONSTRAINT "_RoomTypeToFeature_AB_pkey" PRIMARY KEY ("A", "B");
ALTER TABLE "_RoomTypeToFeature" ADD CONSTRAINT "_RoomTypeToFeature_A_fkey"
    FOREIGN KEY ("A") REFERENCES "RoomFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_RoomTypeToFeature" ADD CONSTRAINT "_RoomTypeToFeature_B_fkey"
    FOREIGN KEY ("B") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 9. Drop old Room columns ────────────────────────────────────
ALTER TABLE "Room"
    DROP COLUMN "type",
    DROP COLUMN "category",
    DROP COLUMN "rate",
    DROP COLUMN "description",
    DROP COLUMN "area",
    DROP COLUMN "bedType",
    DROP COLUMN "capacity",
    DROP COLUMN "view";

-- ─── 10. Drop old junction table ─────────────────────────────────
DROP TABLE "_RoomToFeature";
