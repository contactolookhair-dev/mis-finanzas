import { prisma } from "@/server/db/prisma";
import { listRecentAdminAuditLogsByAction } from "@/server/repositories/admin-audit-repository";
import { listBusinessUnits } from "@/server/repositories/business-unit-repository";
import { listCategories } from "@/server/repositories/category-repository";
import { getUserDashboardFilters } from "@/server/repositories/settings-repository";
import { listTransactions } from "@/server/repositories/transaction-repository";
import type { TransactionFilterInput } from "@/server/query-builders/transaction-query-builder";
import {
  buildKpiComparison,
  getExpenseByBusinessUnit,
  getExpenseByCategory,
  getFinancialOverview,
  getMonthlyTrend,
  getPersonalMoneyUsedInBusiness,
  getReceivablesAsOfDate
} from "@/server/services/analytics-service";
import { getAutomaticInsights } from "@/server/services/insights-service";
import { toAmountNumber } from "@/server/lib/amounts";
import type { DashboardFilters } from "@/shared/types/dashboard";

function toDateBoundary(value?: string, boundary: "start" | "end" = "start") {
  if (!value) return undefined;
  return boundary === "start" ? new Date(`${value}T00:00:00`) : new Date(`${value}T23:59:59.999`);
}

export function buildDashboardTransactionFilters(
  workspaceId: string,
  filters: DashboardFilters = {}
): TransactionFilterInput {
  return {
    workspaceId,
    startDate: toDateBoundary(filters.startDate, "start"),
    endDate: toDateBoundary(filters.endDate, "end"),
    businessUnitId: filters.businessUnitId,
    categoryId: filters.categoryId,
    financialOrigin: filters.financialOrigin,
    reviewStatus: filters.reviewStatus
  };
}

function formatDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultDashboardDateRange(days = 30) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - Math.max(days - 1, 0));

  return {
    startDate: formatDateOnly(start),
    endDate: formatDateOnly(end)
  };
}

function normalizeDashboardFilters(filters?: DashboardFilters | null) {
  const fallback = defaultDashboardDateRange(30);
  return {
    ...filters,
    startDate: filters?.startDate ?? fallback.startDate,
    endDate: filters?.endDate ?? fallback.endDate
  } satisfies DashboardFilters;
}

function buildPreviousPeriodFilters(filters: DashboardFilters) {
  const currentStart = toDateBoundary(filters.startDate, "start");
  const currentEnd = toDateBoundary(filters.endDate, "end");

  if (!currentStart || !currentEnd) {
    return normalizeDashboardFilters(defaultDashboardDateRange(30));
  }

  const span = currentEnd.getTime() - currentStart.getTime() + 1;
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - span + 1);

  return {
    ...filters,
    startDate: formatDateOnly(previousStart),
    endDate: formatDateOnly(previousEnd)
  } satisfies DashboardFilters;
}

function formatPeriodLabel(filters: DashboardFilters) {
  const start = filters.startDate ?? "";
  const end = filters.endDate ?? "";
  return start && end ? `${start} → ${end}` : "Periodo";
}

export async function getDashboardSnapshot(
  workspaceId: string,
  filters: DashboardFilters = {},
  options?: { userKey?: string }
) {
  const resolvedFilters =
    Object.keys(filters).length > 0
      ? normalizeDashboardFilters(filters)
      : normalizeDashboardFilters(
          options?.userKey ? await getUserDashboardFilters(workspaceId, options.userKey) : null
        );
  const previousPeriodFilters = buildPreviousPeriodFilters(resolvedFilters);

  const transactionFilters = buildDashboardTransactionFilters(workspaceId, resolvedFilters);
  const previousTransactionFilters = buildDashboardTransactionFilters(workspaceId, previousPeriodFilters);

  const [
    overview,
    previousOverview,
    personalMoney,
    previousPersonalMoney,
    categoryBreakdown,
    unitBreakdown,
    monthlyTrend,
    insights,
    recentTransactions,
    reviewedStats,
    importLogs,
    businessUnits,
    categories,
    receivables,
    previousReceivables
  ] = await Promise.all([
    getFinancialOverview(transactionFilters),
    getFinancialOverview(previousTransactionFilters),
    getPersonalMoneyUsedInBusiness(transactionFilters),
    getPersonalMoneyUsedInBusiness(previousTransactionFilters),
    getExpenseByCategory(transactionFilters),
    getExpenseByBusinessUnit(transactionFilters),
    getMonthlyTrend(transactionFilters, { months: 6 }),
    getAutomaticInsights(transactionFilters),
    listTransactions({
      ...transactionFilters,
      take: 6,
      order: { field: "date", direction: "desc" }
    }),
    prisma.transaction.groupBy({
      by: ["reviewStatus"],
      where: { workspaceId },
      _count: { _all: true }
    }),
    listRecentAdminAuditLogsByAction(workspaceId, "transactions.import", 4),
    listBusinessUnits(workspaceId),
    listCategories(workspaceId),
    getReceivablesAsOfDate(workspaceId, toDateBoundary(resolvedFilters.endDate, "end")),
    getReceivablesAsOfDate(workspaceId, toDateBoundary(previousPeriodFilters.endDate, "end"))
  ]);

  const reviewedCount = reviewedStats.reduce((sum, item) => sum + item._count._all, 0);
  const reviewedDone =
    reviewedStats.find((item) => item.reviewStatus === "REVISADO")?._count._all ?? 0;

  const importActivity = importLogs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    userKey: log.userKey,
    summary: log.afterData as Record<string, unknown> | null
  }));

  return {
    filters: resolvedFilters,
    references: {
      businessUnits: businessUnits.map((unit) => ({
        id: unit.id,
        name: unit.name,
        type: unit.type
      })),
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        type: category.type
      }))
    },
    kpis: {
      netFlow: overview.net,
      incomes: overview.incomes,
      expenses: overview.expenses,
      personalMoneyInBusiness: personalMoney.total,
      receivables,
      totalTransactions: overview.count,
      reviewedTransactions: reviewedDone,
      reviewedRatio: reviewedCount > 0 ? (reviewedDone / reviewedCount) * 100 : 0
    },
    comparisons: {
      currentPeriodLabel: formatPeriodLabel(resolvedFilters),
      previousPeriodLabel: formatPeriodLabel(previousPeriodFilters),
      incomes: buildKpiComparison(overview.incomes, previousOverview.incomes),
      expenses: buildKpiComparison(overview.expenses, previousOverview.expenses),
      netFlow: buildKpiComparison(overview.net, previousOverview.net),
      personalMoneyInBusiness: buildKpiComparison(personalMoney.total, previousPersonalMoney.total),
      receivables: buildKpiComparison(receivables, previousReceivables),
      chart: [
        {
          key: "incomes",
          label: "Ingresos",
          ...buildKpiComparison(overview.incomes, previousOverview.incomes)
        },
        {
          key: "expenses",
          label: "Egresos",
          ...buildKpiComparison(overview.expenses, previousOverview.expenses)
        },
        {
          key: "netFlow",
          label: "Flujo neto",
          ...buildKpiComparison(overview.net, previousOverview.net)
        },
        {
          key: "personalMoneyInBusiness",
          label: "Dinero personal en empresas",
          ...buildKpiComparison(personalMoney.total, previousPersonalMoney.total)
        },
        {
          key: "receivables",
          label: "Por cobrar",
          ...buildKpiComparison(receivables, previousReceivables)
        }
      ]
    },
    charts: {
      trend: monthlyTrend.map((item) => ({
        month: item.month,
        ingresos: item.incomes,
        egresos: item.expenses,
        neto: item.net
      })),
      categories: categoryBreakdown.map((item) => ({
        name: item.categoryName,
        value: item.total,
        count: item.count
      })),
      businessUnits: unitBreakdown.map((item) => ({
        name: item.businessUnitName,
        value: item.total,
        count: item.count
      })),
      originMix: [
        {
          name: "Personal",
          value:
            filters.financialOrigin === "EMPRESA"
              ? 0
              : Math.max(overview.expenses - personalMoney.total, 0)
        },
        {
          name: "Empresa",
          value: filters.financialOrigin === "PERSONAL" ? 0 : personalMoney.total
        }
      ]
    },
    insights,
    recentTransactions: recentTransactions.items.map((item) => ({
      id: item.id,
      date: item.date.toISOString(),
      description: item.description,
      amount: toAmountNumber(item.amount),
      type: item.type,
      category: item.category?.name ?? "Sin categoria",
      businessUnit: item.businessUnit?.name ?? "Sin asignar",
      reviewStatus: item.reviewStatus
    })),
    importActivity
  };
}
