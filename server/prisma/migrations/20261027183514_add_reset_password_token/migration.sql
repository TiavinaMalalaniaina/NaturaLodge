-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isFirstLogin" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "resetPasswordExpires" TIMESTAMP(3),
ADD COLUMN     "resetPasswordToken" TEXT;

UPDATE "User" SET "isFirstLogin" = false;
