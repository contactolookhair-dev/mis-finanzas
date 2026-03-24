import type { FinancialOrigin } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { buildTransactionWhere, type TransactionFilterInput } from "@/server/query-builders/transaction-query-builder";
import { toAmountNumber } from "@/server/lib/amounts";

type MonthComparison = {
  currentMonth: { label: string; incomes: number; expenses: number; net: number };
  previousMonth: { label: string; incomes: number; expenses: number; net: number };
  variation: { incomesPct: number; expensesPct: number; netPct: number };
};

function monthBounds(referenceDate = new Date()) {
  const currentStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const nextStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  const previousStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
  return { currentStart, nextStart, previousStart };
}

function pctChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function buildKpiComparison(current: number, previous: number) {
  return {
    current,
    previous,
    delta: current - previous,
    deltaPct: pctChange(current, previous)
  };
}

async function getIncomeExpenseTotals(filters: TransactionFilterInput = {}) {
  const where = buildTransactionWhere(filters);

  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...where, type: "INGRESO" },
      _sum: { amount: true }
    }),
    prisma.transaction.aggregate({
      where: { ...where, type: "EGRESO" },
      _sum: { amount: true }
    })
  ]);

  const incomes = Math.abs(toAmountNumber(incomeAgg._sum.amount ?? 0));
  const expenses = Math.abs(toAmountNumber(expenseAgg._sum.amount ?? 0));
  return { incomes, expenses, net: incomes - expenses };
}

export async function getFinancialOverview(filters: TransactionFilterInput = {}) {
  const where = buildTransactionWhere(filters);

  const [totals, count] = await Promise.all([
    getIncomeExpenseTotals(filters),
    prisma.transaction.count({ where })
  ]);

  return {
    ...totals,
    count
  };
}

export async function getMonthComparison(referenceDate = new Date()): Promise<MonthComparison> {
  const { currentStart, nextStart, previousStart } = monthBounds(referenceDate);

  const [current, previous] = await Promise.all([
    getIncomeExpenseTotals({
      startDate: currentStart,
      endDate: nextStart
    }),
    getIncomeExpenseTotals({
      startDate: previousStart,
      endDate: currentStart
    })
  ]);

  return {
    currentMonth: {
      label: `${currentStart.getFullYear()}-${String(currentStart.getMonth() + 1).padStart(2, "0")}`,
      ...current
    },
    previousMonth: {
      label: `${previousStart.getFullYear()}-${String(previousStart.getMonth() + 1).padStart(2, "0")}`,
      ...previous
    },
    variation: {
      incomesPct: pctChange(current.incomes, previous.incomes),
      expensesPct: pctChange(current.expenses, previous.expenses),
      netPct: pctChange(current.net, previous.net)
    }
  };
}

export async function getExpenseByCategory(filters: TransactionFilterInput = {}) {
  const where = buildTransactionWhere({
    ...filters,
    type: "EGRESO"
  });

  const rows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where,
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "asc" } }
  });

  const categories = await prisma.category.findMany({
    where: { id: { in: rows.map((row) => row.categoryId).filter(Boolean) as string[] } },
    select: { id: true, name: true }
  });

  const categoryMap = Object.fromEntries(categories.map((category) => [category.id, category.name]));

  return rows.map((row) => ({
    categoryId: row.categoryId,
    categoryName: row.categoryId ? categoryMap[row.categoryId] ?? "Sin categoría" : "Sin categoría",
    total: Math.abs(toAmountNumber(row._sum.amount ?? 0)),
    count: row._count._all
  }));
}

export async function getSummaryByCategory(filters: TransactionFilterInput = {}) {
  const where = buildTransactionWhere(filters);

  const rows = await prisma.transaction.groupBy({
    by: ["categoryId", "type"],
    where,
    _sum: { amount: true },
    _count: { _all: true }
  });

  const categories = await prisma.category.findMany({
    where: { id: { in: rows.map((row) => row.categoryId).filter(Boolean) as string[] } },
    select: { id: true, name: true }
  });

  const categoryMap = Object.fromEntries(categories.map((category) => [category.id, category.name]));

  const summary: Record<
    string,
    { categoryId: string | null; categoryName: string; incomes: number; expenses: number; net: number; count: number }
  > = {};

  for (const row of rows) {
    const key = row.categoryId ?? "sin-categoria";
    if (!summary[key]) {
      summary[key] = {
        categoryId: row.categoryId,
        categoryName: row.categoryId ? categoryMap[row.categoryId] ?? "Sin categoría" : "Sin categoría",
        incomes: 0,
        expenses: 0,
        net: 0,
        count: 0
      };
    }

    const amount = Math.abs(toAmountNumber(row._sum.amount ?? 0));
    if (row.type === "INGRESO") {
      summary[key].incomes += amount;
    } else {
      summary[key].expenses += amount;
    }
    summary[key].count += row._count._all;
    summary[key].net = summary[key].incomes - summary[key].expenses;
  }

  return Object.values(summary).sort((a, b) => b.expenses - a.expenses);
}

export async function getExpenseByBusinessUnit(filters: TransactionFilterInput = {}) {
  const where = buildTransactionWhere({
    ...filters,
    type: "EGRESO"
  });

  const rows = await prisma.transaction.groupBy({
    by: ["businessUnitId"],
    where,
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "asc" } }
  });

  const units = await prisma.businessUnit.findMany({
    where: { id: { in: rows.map((row) => row.businessUnitId).filter(Boolean) as string[] } },
    select: { id: true, name: true }
  });

  const unitMap = Object.fromEntries(units.map((unit) => [unit.id, unit.name]));

  return rows.map((row) => ({
    businessUnitId: row.businessUnitId,
    businessUnitName: row.businessUnitId ? unitMap[row.businessUnitId] ?? "Sin asignar" : "Sin asignar",
    total: Math.abs(toAmountNumber(row._sum.amount ?? 0)),
    count: row._count._all
  }));
}

export async function getSummaryByBusinessUnit(filters: TransactionFilterInput = {}) {
  const where = buildTransactionWhere(filters);

  const rows = await prisma.transaction.groupBy({
    by: ["businessUnitId", "type"],
    where,
    _sum: { amount: true },
    _count: { _all: true }
  });

  const units = await prisma.businessUnit.findMany({
    where: { id: { in: rows.map((row) => row.businessUnitId).filter(Boolean) as string[] } },
    select: { id: true, name: true }
  });

  const unitMap = Object.fromEntries(units.map((unit) => [unit.id, unit.name]));

  const summary: Record<
    string,
    {
      businessUnitId: string | null;
      businessUnitName: string;
      incomes: number;
      expenses: number;
      net: number;
      count: number;
    }
  > = {};

  for (const row of rows) {
    const key = row.businessUnitId ?? "sin-asignar";
    if (!summary[key]) {
      summary[key] = {
        businessUnitId: row.businessUnitId,
        businessUnitName: row.businessUnitId ? unitMap[row.businessUnitId] ?? "Sin asignar" : "Sin asignar",
        incomes: 0,
        expenses: 0,
        net: 0,
        count: 0
      };
    }

    const amount = Math.abs(toAmountNumber(row._sum.amount ?? 0));
    if (row.type === "INGRESO") {
      summary[key].incomes += amount;
    } else {
      summary[key].expenses += amount;
    }
    summary[key].count += row._count._all;
    summary[key].net = summary[key].incomes - summary[key].expenses;
  }

  return Object.values(summary).sort((a, b) => b.expenses - a.expenses);
}

export async function getPersonalMoneyUsedInBusiness(filters: TransactionFilterInput = {}) {
  const where = buildTransactionWhere({
    ...filters,
    financialOrigin: "EMPRESA" satisfies FinancialOrigin,
    type: "EGRESO",
    isBusinessPaidPersonally: true
  });

  const [aggregate, byUnit] = await Promise.all([
    prisma.transaction.aggregate({
      where,
      _sum: { amount: true },
      _count: { _all: true }
    }),
    prisma.transaction.groupBy({
      by: ["businessUnitId"],
      where,
      _sum: { amount: true },
      _count: { _all: true }
    })
  ]);

  const units = await prisma.businessUnit.findMany({
    where: { id: { in: byUnit.map((row) => row.businessUnitId).filter(Boolean) as string[] } },
    select: { id: true, name: true }
  });
  const unitMap = Object.fromEntries(units.map((unit) => [unit.id, unit.name]));

  return {
    total: Math.abs(toAmountNumber(aggregate._sum.amount ?? 0)),
    count: aggregate._count._all,
    byBusinessUnit: byUnit.map((row) => ({
      businessUnitId: row.businessUnitId,
      businessUnitName: row.businessUnitId ? unitMap[row.businessUnitId] ?? "Sin asignar" : "Sin asignar",
      total: Math.abs(toAmountNumber(row._sum.amount ?? 0)),
      count: row._count._all
    }))
  };
}

export async function getReceivablesAsOfDate(workspaceId: string, endDate?: Date) {
  const debtors = await prisma.debtor.findMany({
    where: {
      workspaceId,
      ...(endDate ? { startDate: { lte: endDate } } : {})
    },
    include: {
      payments: endDate
        ? {
            where: {
              paidAt: { lte: endDate }
            },
            select: {
              amount: true
            }
          }
        : {
            select: {
              amount: true
            }
          }
    }
  });

  return debtors.reduce((sum, debtor) => {
    const totalAmount = toAmountNumber(debtor.totalAmount);
    const paidAmount = debtor.payments.reduce((paymentSum, payment) => {
      return paymentSum + toAmountNumber(payment.amount);
    }, 0);
    return sum + Math.max(totalAmount - paidAmount, 0);
  }, 0);
}

export async function getMonthlyTrend(
  filters: TransactionFilterInput = {},
  options?: { months?: number }
) {
  const months = options?.months ?? 12;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const where = buildTransactionWhere({
    ...filters,
    startDate: filters.startDate ?? start
  });

  const rows = await prisma.transaction.findMany({
    where,
    select: {
      date: true,
      amount: true,
      type: true
    },
    orderBy: { date: "asc" }
  });

  const byMonth = rows.reduce<Record<string, { incomes: number; expenses: number }>>((acc, row) => {
    const key = `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, "0")}`;
    if (!acc[key]) {
      acc[key] = { incomes: 0, expenses: 0 };
    }
    const amount = Math.abs(toAmountNumber(row.amount));
    if (row.type === "INGRESO") {
      acc[key].incomes += amount;
    } else {
      acc[key].expenses += amount;
    }
    return acc;
  }, {});

  return Object.entries(byMonth).map(([month, values]) => {
    const income = values.incomes;
    const expense = values.expenses;
    return {
      month,
      incomes: income,
      expenses: expense,
      net: income - expense
    };
  });
}
