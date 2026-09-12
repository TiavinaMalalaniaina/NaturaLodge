-- CreateTable
CREATE TABLE "kpi_occupancy_target" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "target_rate" DOUBLE PRECISION NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_occupancy_target_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kpi_occupancy_target_month_key" ON "kpi_occupancy_target"("month");
