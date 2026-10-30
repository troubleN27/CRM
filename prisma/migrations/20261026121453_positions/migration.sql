-- CreateEnum
CREATE TYPE "LocationKind" AS ENUM ('OFFICE', 'CITY');

-- AlterTable
ALTER TABLE "LocationPoint" ADD COLUMN     "kind" "LocationKind" NOT NULL DEFAULT 'CITY',
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'phone',
ADD COLUMN     "x" DOUBLE PRECISION,
ADD COLUMN     "y" DOUBLE PRECISION,
ALTER COLUMN "lat" DROP NOT NULL,
ALTER COLUMN "lng" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "LocationPoint_workDayId_at_idx" ON "LocationPoint"("workDayId", "at");
