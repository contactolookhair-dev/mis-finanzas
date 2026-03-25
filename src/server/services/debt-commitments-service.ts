import type { ExpenseFrequency } from "@prisma/client";
import { advanceByFrequency } from "@/server/services/debt-installments";

type InstallmentDebtInput = {
  id: string;
  name: string;
  reason: string;
  installmentValue: number;
  pendingAmount: number;
  pendingInstallments: number;
  nextInstallmentDate: string | null;
  installmentFrequency: ExpenseFrequency;
  status: "PENDIENTE" | "ABONANDO" | "PAGADO" | "ATRASADO";
};

type InstallmentHealth = "AL_DIA" | "PROXIMA" | "VENCIDA" | "PAGADA";

export type DerivedInstallmentStatus = {
  health: InstallmentHealth;
  daysUntilDue: number | null;
  label: string;
};

type UpcomingInstallmentItem = {
  debtId: string;
  debtName: string;
  reason: string;
  dueDate: string;
  amount: number;
  health: InstallmentHealth;
  daysUntilDue: number;
};

type CommitmentSummary = {
  activeInstallmentDebts: number;
  monthlyCommittedTotal: number;
  upcomingCount: number;
  overdueCount: number;
  nextDueDate: string | null;
  nextDueDebtName: string | null;
  upcomingTimeline: UpcomingInstallmentItem[];
};

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function endOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function endOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999);
}

function daysBetween(start: Date, end: Date) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000);
}

export function deriveInstallmentHealth(input: {
  pendingInstallments: number;
  pendingAmount: number;
  nextInstallmentDate: string | null;
  status: "PENDIENTE" | "ABONANDO" | "PAGADO" | "ATRASADO";
}): DerivedInstallmentStatus {
  if (input.pendingInstallments <= 0 || input.pendingAmount <= 0 || input.status === "PAGADO") {
    return {
      health: "PAGADA",
      daysUntilDue: null,
      label: "Pagada"
    };
  }

  if (!input.nextInstallmentDate) {
    return {
      health: "AL_DIA",
      daysUntilDue: null,
      label: "Al dia"
    };
  }

  const today = startOfDay(new Date());
  const dueDate = startOfDay(new Date(input.nextInstallmentDate));
  const diff = daysBetween(today, dueDate);

  if (diff < 0) {
    return {
      health: "VENCIDA",
      daysUntilDue: diff,
      label: "Vencida"
    };
  }

  if (diff <= 7) {
    return {
      health: "PROXIMA",
      daysUntilDue: diff,
      label: "Proxima a vencer"
    };
  }

  return {
    health: "AL_DIA",
    daysUntilDue: diff,
    label: "Al dia"
  };
}

function countOccurrencesWithinMonth(input: {
  nextInstallmentDate: string | null;
  installmentFrequency: ExpenseFrequency;
  pendingInstallments: number;
  referenceDate: Date;
}) {
  if (!input.nextInstallmentDate || input.pendingInstallments <= 0) {
    return 0;
  }

  const monthStart = startOfMonth(input.referenceDate);
  const monthEnd = endOfMonth(input.referenceDate);
  let cursor = startOfDay(new Date(input.nextInstallmentDate));
  let remaining = input.pendingInstallments;
  let count = 0;

  while (remaining > 0 && cursor <= monthEnd) {
    if (cursor >= monthStart) {
      count += 1;
    }
    remaining -= 1;
    if (remaining <= 0) {
      break;
    }
    cursor = startOfDay(advanceByFrequency(cursor, input.installmentFrequency, 1));
  }

  return count;
}

export function buildDebtCommitmentsSummary(items: InstallmentDebtInput[]): CommitmentSummary {
  const today = new Date();
  const upcomingLimit = endOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14));

  const activeItems = items.filter((item) => item.pendingInstallments > 0 && item.pendingAmount > 0);

  const enriched = activeItems.map((item) => {
    const health = deriveInstallmentHealth({
      pendingInstallments: item.pendingInstallments,
      pendingAmount: item.pendingAmount,
      nextInstallmentDate: item.nextInstallmentDate,
      status: item.status
    });

    const dueDate = item.nextInstallmentDate ? startOfDay(new Date(item.nextInstallmentDate)) : null;
    return {
      ...item,
      health,
      dueDate
    };
  });

  const monthlyCommittedTotal = enriched.reduce((sum, item) => {
    const occurrences = countOccurrencesWithinMonth({
      nextInstallmentDate: item.nextInstallmentDate,
      installmentFrequency: item.installmentFrequency,
      pendingInstallments: item.pendingInstallments,
      referenceDate: today
    });
    return sum + item.installmentValue * occurrences;
  }, 0);

  const overdueItems = enriched.filter((item) => item.health.health === "VENCIDA");
  const upcomingItems = enriched
    .filter((item) => item.dueDate && item.dueDate >= startOfDay(today) && item.dueDate <= upcomingLimit)
    .sort((left, right) => (left.dueDate?.getTime() ?? 0) - (right.dueDate?.getTime() ?? 0));

  const nextDue = enriched
    .filter((item) => item.dueDate)
    .sort((left, right) => (left.dueDate?.getTime() ?? 0) - (right.dueDate?.getTime() ?? 0))[0];

  return {
    activeInstallmentDebts: activeItems.length,
    monthlyCommittedTotal,
    upcomingCount: upcomingItems.length,
    overdueCount: overdueItems.length,
    nextDueDate: nextDue?.nextInstallmentDate ?? null,
    nextDueDebtName: nextDue?.name ?? null,
    upcomingTimeline: [...overdueItems, ...upcomingItems]
      .filter((item, index, array) => array.findIndex((current) => current.id === item.id) === index)
      .slice(0, 5)
      .map((item) => ({
        debtId: item.id,
        debtName: item.name,
        reason: item.reason,
        dueDate: item.nextInstallmentDate ?? new Date().toISOString(),
        amount: item.installmentValue,
        health: item.health.health,
        daysUntilDue: item.health.daysUntilDue ?? 0
      }))
  };
}
