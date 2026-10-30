-- CreateEnum
CREATE TYPE "ZoneType" AS ENUM ('WORK', 'MEETING', 'KITCHEN', 'OTHER');

-- AlterEnum
BEGIN;
CREATE TYPE "RequestStatus_new" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'DONE');
ALTER TABLE "public"."Request" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Request" ALTER COLUMN "status" TYPE "RequestStatus_new" USING ("status"::text::"RequestStatus_new");
ALTER TYPE "RequestStatus" RENAME TO "RequestStatus_old";
ALTER TYPE "RequestStatus_new" RENAME TO "RequestStatus";
DROP TYPE "public"."RequestStatus_old";
ALTER TABLE "Request" ALTER COLUMN "status" SET DEFAULT 'NEW';
COMMIT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "phone" TEXT NOT NULL,
ALTER COLUMN "address" SET NOT NULL,
ALTER COLUMN "lat" SET NOT NULL,
ALTER COLUMN "lng" SET NOT NULL;

-- AlterTable
ALTER TABLE "Desk" DROP COLUMN "height",
DROP COLUMN "width",
DROP COLUMN "zone",
ADD COLUMN     "pcNumber" TEXT,
ALTER COLUMN "x" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "y" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Request" DROP COLUMN "address",
DROP COLUMN "lat",
DROP COLUMN "lng",
DROP COLUMN "title",
ALTER COLUMN "description" SET NOT NULL;

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ZoneType" NOT NULL DEFAULT 'OTHER',
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficePlan" (
    "id" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Desk_pcNumber_key" ON "Desk"("pcNumber");

