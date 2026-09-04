-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "ownerProfessionalId" TEXT;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "ownerProfessionalId" TEXT;

-- CreateIndex
CREATE INDEX "appointments_companyId_ownerProfessionalId_startsAt_idx" ON "appointments"("companyId", "ownerProfessionalId", "startsAt");

-- CreateIndex
CREATE INDEX "customers_companyId_ownerProfessionalId_idx" ON "customers"("companyId", "ownerProfessionalId");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_ownerProfessionalId_fkey" FOREIGN KEY ("ownerProfessionalId") REFERENCES "professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_ownerProfessionalId_fkey" FOREIGN KEY ("ownerProfessionalId") REFERENCES "professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
