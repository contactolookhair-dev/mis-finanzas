import { getDashboardSnapshot } from "@/server/services/dashboard-service";
import { getDebtsSnapshot } from "@/server/services/debts-service";
import { getFinancialInsightsCore } from "@/server/services/financial-insights-service";
import type { DashboardFilters } from "@/shared/types/dashboard";
import {
  financialHealthResponseSchema,
  type FinancialHealthFactor,
  type FinancialHealthResponse,
  type FinancialHealthStatus
} from "@/shared/types/financial-health";
import type { FinancialInsightAlert } from "@/shared/types/financial-insights";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function classifyScore(score: number): FinancialHealthStatus {
  if (score >= 75) return "saludable";
  if (score >= 45) return "atencion";
  return "critico";
}

function severityWeight(severity: FinancialInsightAlert["severity"]) {
  switch (severity) {
    case "critical":
      return 3;
    case "warning":
      return 2;
    default:
      return 1;
  }
}

function toneFromSeverity(severity: FinancialInsightAlert["severity"]) {
  switch (severity) {
    case "critical":
      return "danger" as const;
    case "warning":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

function buildStatusCopy(input: {
  status: FinancialHealthStatus;
  savings: number;
  expenseVariationPct: number;
  committedDebtPct: number;
  overdueCount: number;
}) {
  if (input.status === "critico") {
    return {
      headline: "Tu mes necesita atención inmediata",
      summary:
        `El período cerró con ${formatCurrency(input.savings)} de ahorro, ` +
        `el gasto varió ${formatPercent(input.expenseVariationPct)} ` +
        `y tienes ${input.overdueCount} cuotas vencidas con ${formatPercent(input.committedDebtPct)} ` +
        "de tu flujo mensual comprometido."
    };
  }

  if (input.status === "atencion") {
    return {
      headline: "Tu mes tiene señales para vigilar",
      summary:
        `Tu ahorro actual es ${formatCurrency(input.savings)} y el gasto se movió ` +
        `${formatPercent(input.expenseVariationPct)} frente al mes anterior. ` +
        `Las deudas comprometen ${formatPercent(input.committedDebtPct)} de tu ingreso mensual.`
    };
  }

  return {
    headline: "Tu mes se ve saludable",
    summary:
      `Mantienes ${formatCurrency(input.savings)} de ahorro y el gasto ` +
      `${formatPercent(input.expenseVariationPct)} frente al mes anterior. ` +
      `El compromiso de deudas está bajo control con ${formatPercent(input.committedDebtPct)} del ingreso mensual.`
  };
}

function buildFactorList(input: {
  savings: number;
  expenseVariationPct: number;
  committedDebtPct: number;
  overdueCount: number;
  topCategoryName: string | null;
  topCategoryPct: number;
  hormigaCount: number;
  alertCount: number;
}): FinancialHealthFactor[] {
  return [
    {
      id: "savings",
      label: "Ahorro actual",
      value: formatCurrency(input.savings),
      tone: input.savings >= 0 ? "success" : "danger"
    },
    {
      id: "expense-variation",
      label: "Gasto vs mes anterior",
      value: formatPercent(input.expenseVariationPct),
      tone: input.expenseVariationPct <= 0 ? "success" : input.expenseVariationPct < 15 ? "warning" : "danger"
    },
    {
      id: "debt-commitment",
      label: "Flujo comprometido",
      value: formatPercent(input.committedDebtPct),
      tone: input.committedDebtPct < 20 ? "success" : input.committedDebtPct < 35 ? "warning" : "danger"
    },
    {
      id: "overdue",
      label: "Cuotas vencidas",
      value: `${input.overdueCount}`,
      tone: input.overdueCount === 0 ? "success" : input.overdueCount < 3 ? "warning" : "danger"
    },
    {
      id: "top-category",
      label: "Categoría principal",
      value: input.topCategoryName
        ? `${input.topCategoryName} · ${input.topCategoryPct.toFixed(1)}%`
        : "Sin datos",
      tone: input.topCategoryPct < 40 ? "neutral" : input.topCategoryPct < 55 ? "warning" : "danger"
    },
    {
      id: "hormiga",
      label: "Gastos hormiga",
      value: `${input.hormigaCount}`,
      tone: input.hormigaCount === 0 ? "success" : input.hormigaCount < 3 ? "warning" : "danger"
    },
    {
      id: "alerts",
      label: "Alertas importantes",
      value: `${input.alertCount}`,
      tone: input.alertCount === 0 ? "success" : input.alertCount < 3 ? "warning" : "danger"
    }
  ];
}

export async function getFinancialHealthSnapshot(input: {
  workspaceId: string;
  filters?: DashboardFilters;
  userKey?: string;
}): Promise<FinancialHealthResponse> {
  const [dashboard, debts, core] = await Promise.all([
    getDashboardSnapshot(input.workspaceId, input.filters ?? {}, { userKey: input.userKey }),
    getDebtsSnapshot(input.workspaceId),
    getFinancialInsightsCore({
      workspaceId: input.workspaceId,
      filters: input.filters ?? {}
    })
  ]);

  const topExpenseCategory = [...dashboard.charts.categories]
    .sort((left, right) => right.value - left.value)[0] ?? null;
  const committedDebtAmount = debts.commitments.monthlyCommittedTotal;
  const committedDebtPct =
    dashboard.kpis.incomes > 0
      ? (committedDebtAmount / dashboard.kpis.incomes) * 100
      : committedDebtAmount > 0
        ? 100
        : 0;

  const alerts = [...dashboard.insights, ...core.alerts].reduce<FinancialInsightAlert[]>(
    (acc, item) => {
      if (!acc.some((current) => current.id === item.id)) {
        acc.push(item);
      }
      return acc;
    },
    []
  );

  alerts.sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity));

  const hormiga = core.gastosHormiga;
  const rawScore = 100;
  let score = rawScore;

  if (dashboard.kpis.netFlow < 0) score -= 30;
  else if (dashboard.kpis.netFlow < dashboard.kpis.incomes * 0.05) score -= 8;

  if (dashboard.comparisons.expenses.deltaPct > 25) score -= 18;
  else if (dashboard.comparisons.expenses.deltaPct > 15) score -= 12;
  else if (dashboard.comparisons.expenses.deltaPct > 8) score -= 6;

  if (committedDebtPct >= 40) score -= 25;
  else if (committedDebtPct >= 25) score -= 15;
  else if (committedDebtPct >= 15) score -= 8;

  if (debts.commitments.overdueCount > 0) score -= Math.min(24, debts.commitments.overdueCount * 7);

  const topCategoryPct =
    topExpenseCategory && dashboard.kpis.expenses > 0
      ? (topExpenseCategory.value / dashboard.kpis.expenses) * 100
      : 0;
  if (topCategoryPct >= 55) score -= 12;
  else if (topCategoryPct >= 45) score -= 8;

  if (hormiga.length > 0) score -= Math.min(10, hormiga.length * 3);
  if (alerts.some((item) => item.severity === "critical")) score -= 8;

  score = clampScore(score);
  const status = classifyScore(score);
  const copy = buildStatusCopy({
    status,
    savings: dashboard.kpis.netFlow,
    expenseVariationPct: dashboard.comparisons.expenses.deltaPct,
    committedDebtPct,
    overdueCount: debts.commitments.overdueCount
  });

  const response = {
    status,
    score,
    headline: copy.headline,
    summary: copy.summary,
    periodLabel: dashboard.comparisons.currentPeriodLabel,
    metrics: {
      savings: dashboard.kpis.netFlow,
      expenseComparison: dashboard.comparisons.expenses,
      topExpenseCategory:
        topExpenseCategory && dashboard.kpis.expenses > 0
          ? {
              name: topExpenseCategory.name,
              amount: topExpenseCategory.value,
              percentage: topExpenseCategory.value / dashboard.kpis.expenses * 100
            }
          : null,
      committedDebtAmount,
      committedDebtPct,
      overdueCount: debts.commitments.overdueCount,
      upcomingCount: debts.commitments.upcomingCount,
      activeInstallmentDebts: debts.commitments.activeInstallmentDebts,
      hormigaCount: hormiga.length,
      alertCount: alerts.length
    },
    factors: buildFactorList({
      savings: dashboard.kpis.netFlow,
      expenseVariationPct: dashboard.comparisons.expenses.deltaPct,
      committedDebtPct,
      overdueCount: debts.commitments.overdueCount,
      topCategoryName: topExpenseCategory?.name ?? null,
      topCategoryPct,
      hormigaCount: hormiga.length,
      alertCount: alerts.length
    }),
    alerts,
    gastosHormiga: hormiga,
    upcomingTimeline: debts.commitments.upcomingTimeline
  };

  return financialHealthResponseSchema.parse(response);
}
