-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('INTERNAL', 'PUBLIC');

-- CreateEnum
CREATE TYPE "RevenueOwner" AS ENUM ('COMPANY', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "RentalBookingKind" AS ENUM ('SHIFT', 'DAILY');

-- CreateEnum
CREATE TYPE "RentalBookingStatus" AS ENUM ('RESERVED', 'CONFIRMED', 'CANCELED');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "source" "AppointmentSource" NOT NULL DEFAULT 'INTERNAL';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "publicBookingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicDescription" TEXT,
ADD COLUMN     "publicRequiresApproval" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "financial_transactions" ADD COLUMN     "rentalBookingId" TEXT;

-- AlterTable
ALTER TABLE "professionals" ADD COLUMN     "publicBookingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "revenueOwner" "RevenueOwner" NOT NULL DEFAULT 'COMPANY';

-- AlterTable
ALTER TABLE "rentals" ADD COLUMN     "shiftId" TEXT,
ADD COLUMN     "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TEXT NOT NULL,
    "endsAt" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_shift_prices" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "resource_shift_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_bookings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "rentalId" TEXT,
    "shiftId" TEXT,
    "kind" "RentalBookingKind" NOT NULL DEFAULT 'SHIFT',
    "date" TIMESTAMP(3) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "status" "RentalBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod",
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shifts_companyId_isActive_idx" ON "shifts"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_companyId_name_key" ON "shifts"("companyId", "name");

-- CreateIndex
CREATE INDEX "resource_shift_prices_companyId_idx" ON "resource_shift_prices"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "resource_shift_prices_resourceId_shiftId_key" ON "resource_shift_prices"("resourceId", "shiftId");

-- CreateIndex
CREATE INDEX "rental_bookings_companyId_date_idx" ON "rental_bookings"("companyId", "date");

-- CreateIndex
CREATE INDEX "rental_bookings_companyId_resourceId_startsAt_idx" ON "rental_bookings"("companyId", "resourceId", "startsAt");

-- CreateIndex
CREATE INDEX "rental_bookings_companyId_professionalId_startsAt_idx" ON "rental_bookings"("companyId", "professionalId", "startsAt");

-- CreateIndex
CREATE INDEX "rental_bookings_companyId_paymentStatus_idx" ON "rental_bookings"("companyId", "paymentStatus");

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_shift_prices" ADD CONSTRAINT "resource_shift_prices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_shift_prices" ADD CONSTRAINT "resource_shift_prices_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_shift_prices" ADD CONSTRAINT "resource_shift_prices_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_bookings" ADD CONSTRAINT "rental_bookings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_bookings" ADD CONSTRAINT "rental_bookings_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_bookings" ADD CONSTRAINT "rental_bookings_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_bookings" ADD CONSTRAINT "rental_bookings_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_bookings" ADD CONSTRAINT "rental_bookings_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_rentalBookingId_fkey" FOREIGN KEY ("rentalBookingId") REFERENCES "rental_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
