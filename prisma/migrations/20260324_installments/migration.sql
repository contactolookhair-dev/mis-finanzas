ALTER TABLE "Debtor"
ADD COLUMN "isInstallmentDebt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "installmentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "installmentValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "paidInstallments" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "installmentFrequency" "ExpenseFrequency" NOT NULL DEFAULT 'MENSUAL',
ADD COLUMN "nextInstallmentDate" TIMESTAMP(3);
