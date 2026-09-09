-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "publicToken" TEXT;

-- AlterTable
ALTER TABLE "financial_transactions" ADD COLUMN     "ownerProfessionalId" TEXT;

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "national" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "holidays_companyId_date_idx" ON "holidays"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_companyId_date_key" ON "holidays"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_publicToken_key" ON "appointments"("publicToken");

-- CreateIndex
CREATE INDEX "financial_transactions_companyId_ownerProfessionalId_compet_idx" ON "financial_transactions"("companyId", "ownerProfessionalId", "competenceDate");

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_ownerProfessionalId_fkey" FOREIGN KEY ("ownerProfessionalId") REFERENCES "professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
