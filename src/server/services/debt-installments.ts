import { ExpenseFrequency } from "@prisma/client";
import { toAmountNumber, type AmountLike } from "@/server/lib/amounts";

type DebtInstallmentSource = {
  isInstallmentDebt: boolean;
  installmentCount: number;
  installmentValue: AmountLike;
  paidInstallments: number;
  installmentFrequency: ExpenseFrequency;
  startDate: Date;
  nextInstallmentDate: Date | null;
  totalAmount: AmountLike;
  paidAmount: AmountLike;
};

function addMonthsSafe(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addDaysSafe(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function advanceByFrequency(date: Date, frequency: ExpenseFrequency, steps = 1) {
  if (steps <= 0) return new Date(date);
  if (frequency === "SEMANAL") {
    return addDaysSafe(date, 7 * steps);
  }
  if (frequency === "QUINCENAL") {
    return addDaysSafe(date, 15 * steps);
  }
  if (frequency === "ANUAL") {
    const next = new Date(date);
    next.setFullYear(next.getFullYear() + steps);
    return next;
  }
  return addMonthsSafe(date, steps);
}

export function inferPaidInstallmentsFromAmount(
  installmentValue: AmountLike,
  paidAmount: AmountLike,
  installmentCount: number
) {
  const value = toAmountNumber(installmentValue);
  if (value <= 0 || installmentCount <= 0) {
    return 0;
  }
  return Math.min(installmentCount, Math.max(0, Math.floor(toAmountNumber(paidAmount) / value)));
}

export function buildDebtInstallmentPlan(source: DebtInstallmentSource) {
  const totalInstallments = Math.max(0, source.installmentCount);
  const totalAmount = toAmountNumber(source.totalAmount);
  const rawInstallmentValue = Math.max(0, toAmountNumber(source.installmentValue));

  // Some older flows stored installmentCount but left installmentValue empty/0.
  // If we have a total and a count, infer a per-installment value so the UI can show "cuota".
  const inferredInstallmentValue =
    totalInstallments > 1 && rawInstallmentValue <= 0 && totalAmount > 0
      ? Math.round(totalAmount / totalInstallments)
      : rawInstallmentValue;

  const installmentValue = Math.max(0, inferredInstallmentValue);

  // Enable installments if explicitly marked OR if the count indicates it's clearly an installment plan.
  const enabled = (source.isInstallmentDebt || totalInstallments > 1) && totalInstallments > 1 && installmentValue > 0;
  const paidInstallments = enabled
    ? Math.min(totalInstallments, Math.max(0, source.paidInstallments))
    : 0;
  const pendingInstallments = enabled ? Math.max(0, totalInstallments - paidInstallments) : 0;
  const paidAmount = toAmountNumber(source.paidAmount);
  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  const progressPercent =
    enabled && totalInstallments > 0 ? Math.min(100, (paidInstallments / totalInstallments) * 100) : 0;
  const nextInstallmentDate = enabled
    ? source.nextInstallmentDate ?? (pendingInstallments > 0 ? advanceByFrequency(source.startDate, source.installmentFrequency, paidInstallments) : null)
    : null;

  return {
    enabled,
    frequency: source.installmentFrequency,
    totalInstallments,
    installmentValue,
    paidInstallments,
    pendingInstallments,
    remainingAmount,
    progressPercent,
    nextInstallmentDate: nextInstallmentDate?.toISOString() ?? null
  };
}

export function computeNextInstallmentDate(
  startDate: Date,
  frequency: ExpenseFrequency,
  paidInstallments: number,
  totalInstallments: number
) {
  const nextCount = Math.min(totalInstallments, Math.max(0, paidInstallments));
  if (nextCount >= totalInstallments) {
    return null;
  }
  return advanceByFrequency(startDate, frequency, nextCount);
}
