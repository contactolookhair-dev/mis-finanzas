CREATE TYPE "CreditImpactType" AS ENUM ('consume_cupo','no_consume_cupo','pago_tarjeta','ajuste_manual');
ALTER TABLE "Transaction" ADD COLUMN "creditImpactType" "CreditImpactType" NOT NULL DEFAULT 'consume_cupo';
