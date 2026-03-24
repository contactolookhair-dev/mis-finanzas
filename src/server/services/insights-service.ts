import { prisma } from "@/server/db/prisma";
import { buildTransactionWhere, type TransactionFilterInput } from "@/server/query-builders/transaction-query-builder";
import {
  buildKpiComparison,
  getExpenseByBusinessUnit,
  getExpenseByCategory,
  getFinancialOverview,
  getPersonalMoneyUsedInBusiness
} from "@/server/services/analytics-service";

export type InsightSeverity = "info" | "warning" | "critical";

export type FinancialInsight = {
  id: string;
  title: string;
  description: string;
  severity: InsightSeverity;
  metric?: number;
};

type InsightParameters = {
  expenseWarningPct: number;
  criticalPersonalMoney: number;
  categoryGrowthWarningPct: number;
  businessUnitGrowthWarningPct: number;
  concentrationWarningPct: number;
};

function resolveInsightParameters(raw?: Record<string, unknown>): InsightParameters {
  return {
    expenseWarningPct: typeof raw?.expenseWarningPct === "number" ? raw.expenseWarningPct : 15,
    criticalPersonalMoney: typeof raw?.criticalPersonalMoney === "number" ? raw.criticalPersonalMoney : 1000000,
    categoryGrowthWarningPct:
      typeof raw?.categoryGrowthWarningPct === "number" ? raw.categoryGrowthWarningPct : 18,
    businessUnitGrowthWarningPct:
      typeof raw?.businessUnitGrowthWarningPct === "number" ? raw.businessUnitGrowthWarningPct : 18,
    concentrationWarningPct:
      typeof raw?.concentrationWarningPct === "number" ? raw.concentrationWarningPct : 45
  };
}

function normalizePeriod(filters: TransactionFilterInput) {
  const now = new Date();
  const endDate =
    filters.endDate ?? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startDate =
    filters.startDate ??
    new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 29, 0, 0, 0, 0);
  return {
    startDate,
    endDate
  };
}

function buildPreviousPeriodFilters(filters: TransactionFilterInput) {
  const current = normalizePeriod(filters);
  const span = current.endDate.getTime() - current.startDate.getTime() + 1;
  const previousEnd = new Date(current.startDate.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - span + 1);

  return {
    ...filters,
    startDate: previousStart,
    endDate: previousEnd
  };
}

function compareCollections(
  currentItems: Array<{ name: string; value: number }>,
  previousItems: Array<{ name: string; value: number }>
) {
  const previousMap = new Map(previousItems.map((item) => [item.name, item.value]));

  return currentItems
    .map((item) => {
      const previous = previousMap.get(item.name) ?? 0;
      return {
        name: item.name,
        ...buildKpiComparison(item.value, previous)
      };
    })
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
}

export async function getAutomaticInsights(
  filters: TransactionFilterInput = {},
  options?: { insightParameters?: Record<string, unknown> }
) {
  const params = resolveInsightParameters(options?.insightParameters);
  const currentFilters = {
    ...filters,
    ...normalizePeriod(filters)
  };
  const previousFilters = buildPreviousPeriodFilters(currentFilters);

  const [
    overview,
    previousOverview,
    personalMoney,
    previousPersonalMoney,
    categoryBreakdown,
    previousCategoryBreakdown,
    businessUnitBreakdown,
    previousBusinessUnitBreakdown,
    pendingReviewCount
  ] = await Promise.all([
    getFinancialOverview(currentFilters),
    getFinancialOverview(previousFilters),
    getPersonalMoneyUsedInBusiness(currentFilters),
    getPersonalMoneyUsedInBusiness(previousFilters),
    getExpenseByCategory(currentFilters),
    getExpenseByCategory(previousFilters),
    getExpenseByBusinessUnit(currentFilters),
    getExpenseByBusinessUnit(previousFilters),
    filters.workspaceId
      ? prisma.transaction.count({
          where: buildTransactionWhere({
            workspaceId: filters.workspaceId,
            reviewStatuses: ["PENDIENTE", "OBSERVADO"]
          })
        })
      : Promise.resolve(0)
  ]);

  const insights: FinancialInsight[] = [];
  const expenseComparison = buildKpiComparison(overview.expenses, previousOverview.expenses);
  const personalMoneyComparison = buildKpiComparison(
    personalMoney.total,
    previousPersonalMoney.total
  );
  const categoryMovers = compareCollections(
    categoryBreakdown.map((item) => ({ name: item.categoryName, value: item.total })),
    previousCategoryBreakdown.map((item) => ({ name: item.categoryName, value: item.total }))
  );
  const businessUnitMovers = compareCollections(
    businessUnitBreakdown.map((item) => ({ name: item.businessUnitName, value: item.total })),
    previousBusinessUnitBreakdown.map((item) => ({ name: item.businessUnitName, value: item.total }))
  );

  if (expenseComparison.deltaPct > params.expenseWarningPct) {
    insights.push({
      id: "expense-growth",
      title: "Los egresos aceleraron frente al período anterior",
      description: `Tus egresos subieron ${expenseComparison.deltaPct.toFixed(
        1
      )}% y el aumento absoluto fue de ${new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0
      }).format(expenseComparison.delta)}.`,
      severity: expenseComparison.deltaPct > params.expenseWarningPct * 1.6 ? "critical" : "warning",
      metric: expenseComparison.deltaPct
    });
  }

  const topCategory = categoryMovers[0];
  if (topCategory && topCategory.deltaPct > params.categoryGrowthWarningPct) {
    insights.push({
      id: "category-spike",
      title: `La categoría ${topCategory.name} está presionando más tu gasto`,
      description: `Subió ${topCategory.deltaPct.toFixed(
        1
      )}% versus el período anterior y hoy representa ${new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0
      }).format(topCategory.current)} del período actual.`,
      severity: "warning",
      metric: topCategory.deltaPct
    });
  }

  const topBusinessUnit = businessUnitMovers[0];
  if (topBusinessUnit && topBusinessUnit.deltaPct > params.businessUnitGrowthWarningPct) {
    insights.push({
      id: "business-unit-spike",
      title: `${topBusinessUnit.name} está consumiendo más caja`,
      description: `El gasto asociado a esta unidad subió ${topBusinessUnit.deltaPct.toFixed(
        1
      )}% frente al período anterior.`,
      severity: "warning",
      metric: topBusinessUnit.deltaPct
    });
  }

  const totalExpense = categoryBreakdown.reduce((sum, item) => sum + item.total, 0);
  const topCurrentCategory = categoryBreakdown[0];
  if (
    topCurrentCategory &&
    totalExpense > 0 &&
    (topCurrentCategory.total / totalExpense) * 100 >= params.concentrationWarningPct
  ) {
    insights.push({
      id: "expense-concentration",
      title: "Tu gasto está muy concentrado",
      description: `${topCurrentCategory.categoryName} representa ${(
        (topCurrentCategory.total / totalExpense) *
        100
      ).toFixed(1)}% de los egresos del período. Conviene revisar si ese peso es saludable.`,
      severity: "info",
      metric: (topCurrentCategory.total / totalExpense) * 100
    });
  }

  if (personalMoney.total > 0) {
    insights.push({
      id: "personal-money-in-business",
      title: "Sigues financiando gastos empresariales con dinero personal",
      description: `Hay ${new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0
      }).format(personalMoney.total)} pagados con fondos personales en el período, con una variación de ${personalMoneyComparison.deltaPct.toFixed(
        1
      )}% frente al anterior.`,
      severity: personalMoney.total > params.criticalPersonalMoney ? "critical" : "info",
      metric: personalMoney.total
    });
  }

  if (pendingReviewCount > 0) {
    insights.push({
      id: "review-backlog",
      title: "Hay movimientos pendientes de revisar",
      description: `Tienes ${pendingReviewCount} movimientos en estado pendiente u observado. Eso puede sesgar análisis y reglas automáticas.`,
      severity: pendingReviewCount > 25 ? "warning" : "info",
      metric: pendingReviewCount
    });
  }

  return insights.slice(0, 5);
}
