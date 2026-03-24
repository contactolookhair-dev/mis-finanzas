import { prisma } from "@/server/db/prisma";
import { buildTransactionWhere, type TransactionFilterInput } from "@/server/query-builders/transaction-query-builder";
import {
  buildKpiComparison,
  getExpenseByBusinessUnit,
  getExpenseByCategory,
  getFinancialOverview,
  getMonthlyTrend,
  getPersonalMoneyUsedInBusiness
} from "@/server/services/analytics-service";
import { getAutomaticInsights } from "@/server/services/insights-service";
import { toAmountNumber } from "@/server/lib/amounts";

type InsightParameters = {
  expenseWarningPct: number;
  criticalPersonalMoney: number;
  categoryGrowthWarningPct: number;
  businessUnitGrowthWarningPct: number;
  concentrationWarningPct: number;
  recommendationAggressiveness: number;
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
      typeof raw?.concentrationWarningPct === "number" ? raw.concentrationWarningPct : 45,
    recommendationAggressiveness:
      typeof raw?.recommendationAggressiveness === "number" ? raw.recommendationAggressiveness : 60
  };
}

function formatDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateBoundary(value?: Date, boundary: "start" | "end" = "start") {
  if (!value) return undefined;
  return boundary === "start"
    ? new Date(`${formatDateOnly(value)}T00:00:00`)
    : new Date(`${formatDateOnly(value)}T23:59:59.999`);
}

function normalizePeriod(filters: TransactionFilterInput) {
  const now = new Date();
  const endDate = filters.endDate ?? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startDate =
    filters.startDate ?? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 29, 0, 0, 0, 0);
  return {
    startDate: toDateBoundary(startDate, "start") ?? startDate,
    endDate: toDateBoundary(endDate, "end") ?? endDate
  };
}

function buildPreviousPeriodFilters(filters: TransactionFilterInput): TransactionFilterInput {
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

function normalizeDescription(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function getRecurringExpensePatterns(filters: TransactionFilterInput) {
  const rows = await prisma.transaction.findMany({
    where: buildTransactionWhere({
      ...filters,
      type: "EGRESO"
    }),
    select: {
      description: true,
      amount: true,
      date: true,
      category: { select: { name: true } }
    },
    orderBy: { date: "desc" },
    take: 300
  });

  const grouped = rows.reduce<
    Record<
      string,
      { description: string; total: number; count: number; categoryName: string; average: number }
    >
  >((acc, row) => {
    const key = normalizeDescription(row.description);
    if (!key || key.length < 4) return acc;
    if (!acc[key]) {
      acc[key] = {
        description: row.description,
        total: 0,
        count: 0,
        categoryName: row.category?.name ?? "Sin categoría",
        average: 0
      };
    }
    acc[key].total += Math.abs(toAmountNumber(row.amount));
    acc[key].count += 1;
    acc[key].average = acc[key].total / acc[key].count;
    return acc;
  }, {});

  return Object.values(grouped)
    .filter((item) => item.count >= 3)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

function buildRecommendations(input: {
  expenseMovers: ReturnType<typeof compareCollections>;
  businessUnitMovers: ReturnType<typeof compareCollections>;
  personalMoneyDelta: number;
  recurringPatterns: Awaited<ReturnType<typeof getRecurringExpensePatterns>>;
  params: InsightParameters;
}) {
  const recommendations: string[] = [];
  const thresholdFactor = input.params.recommendationAggressiveness / 100;
  const topCategory = input.expenseMovers[0];
  const topBusinessUnit = input.businessUnitMovers[0];
  const topRecurring = input.recurringPatterns[0];

  if (topCategory && topCategory.deltaPct > input.params.categoryGrowthWarningPct * thresholdFactor) {
    recommendations.push(
      `Revisa la categoría ${topCategory.name}: subió ${topCategory.deltaPct.toFixed(
        1
      )}% versus el período anterior y está explicando buena parte del alza.`
    );
  }

  if (
    topBusinessUnit &&
    topBusinessUnit.deltaPct > input.params.businessUnitGrowthWarningPct * thresholdFactor
  ) {
    recommendations.push(
      `Audita el gasto de ${topBusinessUnit.name}: es la unidad con mayor presión incremental de caja en el período analizado.`
    );
  }

  if (input.personalMoneyDelta > input.params.criticalPersonalMoney * 0.15) {
    recommendations.push(
      "Conviene revisar reembolsos internos: el uso de dinero personal en empresas viene creciendo y puede distorsionar tu caja real."
    );
  }

  if (topRecurring && topRecurring.total > 50000 * thresholdFactor) {
    recommendations.push(
      `Hay movimientos repetitivos en ${topRecurring.description} (${topRecurring.count} veces). Vale la pena revisar si corresponde automatizar, renegociar o recategorizar mejor ese gasto.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "No veo una alarma fuerte inmediata, pero sí conviene monitorear semanalmente las categorías con mayor variación y los pagos empresariales cubiertos con fondos personales."
    );
  }

  return recommendations.slice(0, 4);
}

export async function buildFinancialAnalysisContext(input: {
  workspaceId: string;
  filters: TransactionFilterInput;
  insightParameters?: Record<string, unknown>;
}) {
  const params = resolveInsightParameters(input.insightParameters);
  const currentFilters = {
    ...input.filters,
    workspaceId: input.workspaceId,
    ...normalizePeriod(input.filters)
  };
  const previousFilters = buildPreviousPeriodFilters(currentFilters);

  const [
    overview,
    previousOverview,
    personalMoney,
    previousPersonalMoney,
    categoriesCurrent,
    categoriesPrevious,
    businessUnitsCurrent,
    businessUnitsPrevious,
    monthlyTrend,
    recurringPatterns,
    insights
  ] = await Promise.all([
    getFinancialOverview(currentFilters),
    getFinancialOverview(previousFilters),
    getPersonalMoneyUsedInBusiness(currentFilters),
    getPersonalMoneyUsedInBusiness(previousFilters),
    getExpenseByCategory(currentFilters),
    getExpenseByCategory(previousFilters),
    getExpenseByBusinessUnit(currentFilters),
    getExpenseByBusinessUnit(previousFilters),
    getMonthlyTrend(currentFilters, { months: 6 }),
    getRecurringExpensePatterns({
      ...currentFilters,
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120)
    }),
    getAutomaticInsights(currentFilters, { insightParameters: params })
  ]);

  const categoryMovers = compareCollections(
    categoriesCurrent.map((item) => ({ name: item.categoryName, value: item.total })),
    categoriesPrevious.map((item) => ({ name: item.categoryName, value: item.total }))
  );
  const businessUnitMovers = compareCollections(
    businessUnitsCurrent.map((item) => ({ name: item.businessUnitName, value: item.total })),
    businessUnitsPrevious.map((item) => ({ name: item.businessUnitName, value: item.total }))
  );

  const recommendations = buildRecommendations({
    expenseMovers: categoryMovers,
    businessUnitMovers,
    personalMoneyDelta: personalMoney.total - previousPersonalMoney.total,
    recurringPatterns,
    params
  });

  return {
    currentPeriod: {
      startDate: currentFilters.startDate?.toISOString(),
      endDate: currentFilters.endDate?.toISOString()
    },
    previousPeriod: {
      startDate: previousFilters.startDate?.toISOString(),
      endDate: previousFilters.endDate?.toISOString()
    },
    overview,
    previousOverview,
    comparisons: {
      incomes: buildKpiComparison(overview.incomes, previousOverview.incomes),
      expenses: buildKpiComparison(overview.expenses, previousOverview.expenses),
      netFlow: buildKpiComparison(overview.net, previousOverview.net),
      personalMoneyInBusiness: buildKpiComparison(personalMoney.total, previousPersonalMoney.total)
    },
    categoriesCurrent,
    businessUnitsCurrent,
    categoryMovers,
    businessUnitMovers,
    personalMoney,
    previousPersonalMoney,
    monthlyTrend,
    recurringPatterns,
    insights,
    recommendations
  };
}
