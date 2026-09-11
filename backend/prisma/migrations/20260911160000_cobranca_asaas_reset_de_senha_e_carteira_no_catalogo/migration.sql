-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('BOLETO', 'PIX', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'RECEIVED', 'OVERDUE', 'REFUNDED', 'CANCELED');

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "ownerProfessionalId" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "asaasCustomerId" TEXT,
ADD COLUMN     "asaasSubscriptionId" TEXT,
ADD COLUMN     "billingType" "BillingType";

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "asaasPaymentId" TEXT NOT NULL,
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "billingType" "BillingType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "paidAt" TIMESTAMP(3),
    "invoiceUrl" TEXT,
    "bankSlipUrl" TEXT,
    "pixPayload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payments_asaasPaymentId_key" ON "subscription_payments"("asaasPaymentId");

-- CreateIndex
CREATE INDEX "subscription_payments_companyId_dueDate_idx" ON "subscription_payments"("companyId", "dueDate");

-- CreateIndex
CREATE INDEX "subscription_payments_status_idx" ON "subscription_payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_tokenHash_key" ON "password_resets"("tokenHash");

-- CreateIndex
CREATE INDEX "password_resets_userId_idx" ON "password_resets"("userId");

-- CreateIndex
CREATE INDEX "services_companyId_ownerProfessionalId_idx" ON "services"("companyId", "ownerProfessionalId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_asaasSubscriptionId_key" ON "subscriptions"("asaasSubscriptionId");

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_ownerProfessionalId_fkey" FOREIGN KEY ("ownerProfessionalId") REFERENCES "professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

