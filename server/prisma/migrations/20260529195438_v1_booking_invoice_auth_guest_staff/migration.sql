-- AlterTable
ALTER TABLE "_RoomToFeature" ADD CONSTRAINT "_RoomToFeature_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_RoomToFeature_AB_unique";
