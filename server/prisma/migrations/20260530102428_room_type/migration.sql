-- DropIndex
DROP INDEX "_RoomTypeToFeature_AB_unique";

-- AlterTable
ALTER TABLE "Room" ALTER COLUMN "images" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "RoomType" ALTER COLUMN "updatedAt" DROP DEFAULT;
