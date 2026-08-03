-- CreateEnum
CREATE TYPE "ExtraPricing" AS ENUM ('PER_NIGHT', 'ONE_TIME');

-- CreateTable
CREATE TABLE "Extra" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "pricing" "ExtraPricing" NOT NULL DEFAULT 'ONE_TIME',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Extra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRoomExtra" (
    "id" TEXT NOT NULL,
    "bookingRoomId" TEXT NOT NULL,
    "extraId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "pricing" "ExtraPricing" NOT NULL,

    CONSTRAINT "BookingRoomExtra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingRoomExtra_bookingRoomId_extraId_key" ON "BookingRoomExtra"("bookingRoomId", "extraId");

-- AddForeignKey
ALTER TABLE "BookingRoomExtra" ADD CONSTRAINT "BookingRoomExtra_bookingRoomId_fkey" FOREIGN KEY ("bookingRoomId") REFERENCES "BookingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRoomExtra" ADD CONSTRAINT "BookingRoomExtra_extraId_fkey" FOREIGN KEY ("extraId") REFERENCES "Extra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
