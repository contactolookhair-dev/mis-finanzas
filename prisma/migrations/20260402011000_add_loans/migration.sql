-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('LENT', 'BORROWED');

-- CreateEnum
CREATE TYPE "LoanCounterpartyType" AS ENUM ('PERSON', 'COMPANY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "LoanInterestType" AS ENUM ('FIXED', 'MONTHLY_PERCENT', 'ANNUAL_PERCENT');

-- CreateTable
CREATE TABLE "Loan" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "loanType" "LoanType" NOT NULL,
  "counterpartyType" "LoanCounterpartyType" NOT NULL,
  "counterpartyName" TEXT NOT NULL,
  "businessUnitId" TEXT,
  "sourceAccountId" TEXT,
  "amountTotal" DECIMAL(14,2) NOT NULL,
  "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "amountPending" DECIMAL(14,2) NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
  "description" TEXT,
  "hasInterest" BOOLEAN NOT NULL DEFAULT false,
  "interestType" "LoanInterestType",
  "interestValue" DECIMAL(14,6),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanPayment" (
  "id" TEXT NOT NULL,
  "loanId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Loan_workspaceId_loanType_status_idx" ON "Loan"("workspaceId", "loanType", "status");

-- CreateIndex
CREATE INDEX "Loan_workspaceId_counterpartyName_idx" ON "Loan"("workspaceId", "counterpartyName");

-- CreateIndex
CREATE INDEX "LoanPayment_loanId_paidAt_idx" ON "LoanPayment"("loanId", "paidAt");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

