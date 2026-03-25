import "server-only";

import { buildFinancialAnalysisContext } from "@/server/services/ai/financial-analysis";
import { getReceivablesAsOfDate } from "@/server/services/analytics-service";
import type { DashboardFilters } from "@/shared/types/dashboard";
import {
  financialInsightsResponseSchema,
  type FinancialInsightAlert,
  type FinancialInsightCategory,
  type FinancialInsightHormiga,
  type FinancialInsightRecommendation,
  type FinancialInsightsResponse
} from "@/shared/types/financial-insights";
import type { TransactionFilterInput } from "@/server/query-builders/transaction-query-builder";

type FinancialInsightsSummaryInput = {
  workspaceId: string;
  filters: DashboardFilters;
};

type GeminiFinancialInsightsPayload = {
  summary: string;
  alerts: Array<{
    id?: string;
    title: string;
    description: string;
    severity: "info" | "warning" | "critical";
  }>;
  recommendations: Array<{
    id?: string;
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
  }>;
};

function formatDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateBoundary(value?: string, boundary: "start" | "end" = "start") {
  if (!value) return undefined;
  return boundary === "start" ? new Date(`${value}T00:00:00`) : new Date(`${value}T23:59:59.999`);
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

function buildTransactionFilters(workspaceId: string, filters: DashboardFilters): TransactionFilterInput {
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(value);
}

function buildPeriodLabel(filters: DashboardFilters) {
  const start = filters.startDate ?? "";
  const end = filters.endDate ?? "";
  return start && end ? `${start} → ${end}` : "Periodo actual";
}

function buildFallbackAnswer(input: {
  summary: FinancialInsightsSummaryInput;
  analysis: Awaited<ReturnType<typeof buildFinancialAnalysisContext>>;
  receivables: number;
  topCategories: FinancialInsightCategory[];
  gastosHormiga: FinancialInsightHormiga[];
  alerts: FinancialInsightAlert[];
  recommendations: FinancialInsightRecommendation[];
}) {
  const topCategory = input.topCategories[0];
  const topHormiga = input.gastosHormiga[0];
  const personalMoney = input.analysis.personalMoney.total;

  const summaryParts = [
    `En el período ${buildPeriodLabel(input.summary.filters)} registraste ${formatCurrency(
      input.analysis.overview.incomes
    )} en ingresos y ${formatCurrency(input.analysis.overview.expenses)} en gastos.`,
    topCategory
      ? `La categoría más pesada fue ${topCategory.name}, con ${topCategory.percentage.toFixed(1)}% del gasto total.`
      : "",
    topHormiga
      ? `Detecté gastos hormiga asociados a ${topHormiga.description}, con ${topHormiga.count} movimientos repetidos.`
      : "",
    input.receivables > 0
      ? `Además, tienes ${formatCurrency(input.receivables)} por cobrar en total.`
      : "",
    personalMoney > 0
      ? `También se observa ${formatCurrency(personalMoney)} de dinero personal usado en empresas.`
      : ""
  ]
    .filter(Boolean)
    .join(" ");

  return {
    summary: summaryParts,
    alerts: input.alerts,
    recommendations: input.recommendations
  };
}

async function callGeminiFinancialInsights(input: {
  summary: Record<string, unknown>;
  model: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "Eres un analista financiero. Usa solo el JSON proporcionado. No inventes cifras ni datos. Responde solo con JSON valido y sin markdown."
            }
          ]
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Resume estos datos financieros y devuelve JSON con summary, alerts y recommendations. " +
                  "alerts debe ser un arreglo de objetos con id, title, description y severity. " +
                  "recommendations debe ser un arreglo de objetos con id, title, description y priority. " +
                  "Usa los datos tal como vienen.\n\n" +
                  JSON.stringify(input.summary, null, 2)
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const payload = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!content) {
    throw new Error("Gemini returned empty content");
  }

  return JSON.parse(content) as GeminiFinancialInsightsPayload;
}

function normalizeAIOutput(payload: GeminiFinancialInsightsPayload) {
  return {
    summary: typeof payload.summary === "string" ? payload.summary : "",
    alerts: Array.isArray(payload.alerts)
      ? payload.alerts.map((item, index) => ({
          id: item.id ?? `alert-${index}`,
          title: item.title,
          description: item.description,
          severity: item.severity
        }))
      : [],
    recommendations: Array.isArray(payload.recommendations)
      ? payload.recommendations.map((item, index) => ({
          id: item.id ?? `recommendation-${index}`,
          title: item.title,
          description: item.description,
          priority: item.priority
        }))
      : []
  };
}

export async function buildFinancialInsights(input: FinancialInsightsSummaryInput): Promise<FinancialInsightsResponse> {
  const normalizedFilters = normalizeDashboardFilters(input.filters);
  const transactionFilters = buildTransactionFilters(input.workspaceId, normalizedFilters);
  const analysis = await buildFinancialAnalysisContext({
    workspaceId: input.workspaceId,
    filters: transactionFilters
  });

  const receivables = await getReceivablesAsOfDate(
    input.workspaceId,
    toDateBoundary(normalizedFilters.endDate, "end")
  );

  const totalExpense = analysis.categoriesCurrent.reduce((sum, item) => sum + item.total, 0);
  const topCategories = analysis.categoriesCurrent.slice(0, 5).map((item) => ({
    id: item.categoryId ?? item.categoryName,
    name: item.categoryName,
    amount: item.total,
    percentage: totalExpense > 0 ? (item.total / totalExpense) * 100 : 0,
    count: item.count
  }));

  const gastosHormiga = analysis.recurringPatterns
    .filter((item) => item.count >= 3 && item.average <= 15000)
    .slice(0, 5)
    .map((item) => ({
      id: item.description.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description: item.description,
      category: item.categoryName,
      amount: item.total,
      average: item.average,
      count: item.count
    }));

  const alertCandidates = analysis.insights.slice(0, 6).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    severity: item.severity
  }));

  const recommendationCandidates = analysis.recommendations.slice(0, 6).map((item, index) => ({
    id: `recommendation-${index}`,
    title: `Recomendación ${index + 1}`,
    description: item,
    priority: index === 0 ? "high" : index === 1 ? "medium" : "low"
  })) satisfies GeminiFinancialInsightsPayload["recommendations"];

  const summaryPayload = {
    period: {
      startDate: normalizedFilters.startDate,
      endDate: normalizedFilters.endDate,
      label: buildPeriodLabel(normalizedFilters)
    },
    overview: {
      incomes: analysis.overview.incomes,
      expenses: analysis.overview.expenses,
      savings: analysis.overview.net,
      receivables
    },
    comparisons: analysis.comparisons,
    topCategories,
    gastosHormiga,
    personalMoneyUsedInBusiness: analysis.personalMoney,
    alerts: alertCandidates,
    recommendations: recommendationCandidates
  };

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const generated = await callGeminiFinancialInsights({
    summary: summaryPayload,
    model
  }).catch(() => null);

  const aiOutput = generated ? normalizeAIOutput(generated) : null;
  const fallback = buildFallbackAnswer({
    summary: { workspaceId: input.workspaceId, filters: normalizedFilters },
    analysis,
    receivables,
    topCategories,
    gastosHormiga,
    alerts: alertCandidates,
    recommendations: recommendationCandidates
  });

  return financialInsightsResponseSchema.parse({
    summary: aiOutput?.summary?.trim() || fallback.summary,
    topCategories,
    gastosHormiga,
    alerts: aiOutput?.alerts.length ? aiOutput.alerts : fallback.alerts,
    recommendations: aiOutput?.recommendations.length ? aiOutput.recommendations : fallback.recommendations,
    period: {
      startDate: normalizedFilters.startDate!,
      endDate: normalizedFilters.endDate!,
      label: buildPeriodLabel(normalizedFilters)
    },
    model,
    source: aiOutput ? "gemini" : "fallback"
  });
}
