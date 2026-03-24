import type { TransactionFilterInput } from "@/server/query-builders/transaction-query-builder";
import {
  getFinancialOverview,
  getMonthlyTrend,
  getSummaryByBusinessUnit,
  getSummaryByCategory,
  getPersonalMoneyUsedInBusiness
} from "@/server/services/analytics-service";
import { listTransactions } from "@/server/repositories/transaction-repository";
import { getAutomaticInsights } from "@/server/services/insights-service";
import { composeFinancialAnswer } from "@/server/services/ai/compose-response";
import { interpretFinancialQuery, type AIIntent } from "@/server/services/ai/interpret-query";
import { createAIProvider } from "@/server/services/ai-provider";
import { getResolvedSettings } from "@/server/services/settings-service";
import { getAvailableAIContext, resolveAIQueryFilters } from "@/server/services/ai/resolve-filters";
import { buildFinancialAnalysisContext } from "@/server/services/ai/financial-analysis";
import type { FinancialAIResponse, FinancialAISection } from "@/shared/types/ai";

export type FinancialAIQueryInput = {
  question: string;
  workspaceId: string;
  userKey: string;
  filters?: TransactionFilterInput;
  limit?: number;
};

function buildBaseScope(input: { workspaceId: string; filters?: TransactionFilterInput }) {
  return {
    workspaceId: input.workspaceId,
    dateRange: {
      startDate: input.filters?.startDate?.toISOString(),
      endDate: input.filters?.endDate?.toISOString()
    }
  };
}

function withWorkspaceFilters(workspaceId: string, filters?: TransactionFilterInput) {
  return {
    ...filters,
    workspaceId
  };
}

function buildDraftFromSections(sections: FinancialAISection) {
  return [
    sections.summary,
    sections.explanation,
    sections.recommendations.length > 0
      ? `Recomendaciones: ${sections.recommendations.join(" ")}`
      : "",
    sections.keyFindings.length > 0 ? `Hallazgos: ${sections.keyFindings.join(" ")}` : ""
  ]
    .filter(Boolean)
    .join(" ");
}

async function buildNarrativeAnswer(input: {
  provider: ReturnType<typeof createAIProvider>;
  settings: Awaited<ReturnType<typeof getResolvedSettings>>["aiSettings"];
  baseAnswer: string;
  question: string;
  contextData: unknown;
  sections: FinancialAISection;
}) {
  return composeFinancialAnswer({
    provider: input.provider,
    baseAnswer: input.baseAnswer,
    draftAnswer: buildDraftFromSections(input.sections),
    systemPrompt: input.settings.systemPrompt ?? undefined,
    tone: input.settings.responseTone ?? undefined,
    detailLevel: input.settings.responseDetailLevel ?? undefined,
    question: input.question,
    contextData: input.contextData
  });
}

function buildGenericDataUsed(scope: ReturnType<typeof buildBaseScope>, extras: string[]) {
  return [
    scope.dateRange?.startDate || scope.dateRange?.endDate
      ? `Rango consultado: ${scope.dateRange?.startDate ?? "sin inicio"} a ${scope.dateRange?.endDate ?? "sin fin"}`
      : "Rango consultado: no especificado explícitamente; se usó el período inferido por la consulta.",
    ...extras
  ];
}

function asInsightParameters(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export async function queryFinancialAI(input: FinancialAIQueryInput): Promise<FinancialAIResponse> {
  if (!input.workspaceId) {
    throw new Error("workspaceId is required for AI queries");
  }
  if (!input.userKey) {
    throw new Error("userKey is required for AI queries");
  }

  const settings = await getResolvedSettings(input.workspaceId, input.userKey);
  const provider = createAIProvider({
    modelProvider: settings.aiSettings.modelProvider,
    modelName: settings.aiSettings.modelName
  });
  const available = await getAvailableAIContext(input.workspaceId);
  const interpreted = await interpretFinancialQuery({
    provider,
    question: input.question,
    systemPrompt: settings.aiSettings.systemPrompt ?? undefined,
    tone: settings.aiSettings.responseTone ?? undefined,
    detailLevel: settings.aiSettings.responseDetailLevel ?? undefined,
    businessUnits: available.businessUnits.map((item) => item.name),
    categories: available.categories.map((item) => item.name)
  });

  const resolved = await resolveAIQueryFilters({
    interpreted,
    workspaceId: input.workspaceId,
    baseFilters: withWorkspaceFilters(input.workspaceId, input.filters)
  });

  const scope = buildBaseScope({
    workspaceId: input.workspaceId,
    filters: resolved.filters
  });

  switch (resolved.intent) {
    case "analysis": {
      const analysis = await buildFinancialAnalysisContext({
        workspaceId: input.workspaceId,
        filters: resolved.filters,
        insightParameters: asInsightParameters(settings.aiSettings.insightParameters)
      });

      const topCategory = analysis.categoryMovers[0];
      const topBusinessUnit = analysis.businessUnitMovers[0];
      const worstTrendMonth = [...analysis.monthlyTrend]
        .sort((left, right) => right.expenses - left.expenses)[0];

      const sections: FinancialAISection = {
        summary: `Analicé tu histórico real y veo que el cambio principal está en los egresos y en cómo se concentran por categoría y negocio.`,
        explanation: [
          `Los ingresos variaron ${analysis.comparisons.incomes.deltaPct.toFixed(1)}% y los egresos ${analysis.comparisons.expenses.deltaPct.toFixed(1)}% respecto al período anterior.`,
          topCategory
            ? `La categoría con mayor cambio fue ${topCategory.name}, con una variación de ${topCategory.deltaPct.toFixed(1)}%.`
            : "",
          topBusinessUnit
            ? `La unidad con mayor presión de gasto fue ${topBusinessUnit.name}, con una variación de ${topBusinessUnit.deltaPct.toFixed(1)}%.`
            : "",
          worstTrendMonth
            ? `En la tendencia reciente, el mes más exigente en egresos fue ${worstTrendMonth.month}.`
            : ""
        ]
          .filter(Boolean)
          .join(" "),
        recommendations: analysis.recommendations,
        keyFindings: analysis.insights.map((item) => item.title),
        dataUsed: buildGenericDataUsed(scope, [
          `Comparativa usada: ${analysis.currentPeriod.startDate ?? "N/D"} a ${analysis.currentPeriod.endDate ?? "N/D"} versus ${analysis.previousPeriod.startDate ?? "N/D"} a ${analysis.previousPeriod.endDate ?? "N/D"}.`,
          `Tendencia histórica considerada: ${analysis.monthlyTrend.length} puntos mensuales.`,
          `Patrones recurrentes analizados: ${analysis.recurringPatterns.length} grupos detectados.`
        ])
      };

      return {
        intent: resolved.intent,
        question: input.question,
        scope,
        answer: await buildNarrativeAnswer({
          provider,
          settings: settings.aiSettings,
          baseAnswer: "Análisis financiero personalizado basado en tu histórico real.",
          question: input.question,
          contextData: analysis,
          sections
        }),
        data: analysis,
        source: "internal_analytics",
        nextSuggestedQuestions: [
          "¿Qué categoría debería vigilar la próxima semana?",
          "¿Qué negocio está deteriorando más mi flujo neto?",
          "¿Qué gasto repetitivo convendría optimizar primero?"
        ],
        interpretedQuery: resolved.extracted,
        sections
      };
    }
    case "by_business_unit": {
      const summary = await getSummaryByBusinessUnit(resolved.filters);
      const top = summary[0];
      const sections: FinancialAISection = {
        summary: top
          ? `${top.businessUnitName} es la unidad más exigente en el período consultado.`
          : "No detecté suficientes movimientos para dividir por unidad de negocio.",
        explanation: top
          ? `Esta unidad acumula ${top.expenses.toLocaleString("es-CL")} CLP en egresos y ${top.incomes.toLocaleString(
              "es-CL"
            )} CLP en ingresos dentro del rango consultado.`
          : "No hubo datos suficientes para construir el desglose por negocio.",
        recommendations: top
          ? [`Revisa si ${top.businessUnitName} está absorbiendo más caja de la esperada respecto a su nivel de ingresos.`]
          : [],
        keyFindings: summary.slice(0, 3).map((item) => `${item.businessUnitName}: egresos ${item.expenses.toLocaleString("es-CL")} CLP`),
        dataUsed: buildGenericDataUsed(scope, [
          `Unidades evaluadas: ${summary.length}.`
        ])
      };

      return {
        intent: resolved.intent,
        question: input.question,
        scope,
        answer: await buildNarrativeAnswer({
          provider,
          settings: settings.aiSettings,
          baseAnswer: "Resumen de ingresos y egresos por unidad de negocio.",
          question: input.question,
          contextData: summary,
          sections
        }),
        data: summary,
        source: "internal_analytics",
        nextSuggestedQuestions: [
          "¿Qué unidad tiene mayor gasto este mes?",
          "¿Dónde aumentó más el egreso?"
        ],
        interpretedQuery: resolved.extracted,
        sections
      };
    }
    case "by_category": {
      const summary = await getSummaryByCategory(resolved.filters);
      const top = summary[0];
      const sections: FinancialAISection = {
        summary: top
          ? `${top.categoryName} destaca como la categoría más relevante del período.`
          : "No encontré suficientes movimientos categorizados para responder con precisión.",
        explanation: top
          ? `Esta categoría acumula ${top.expenses.toLocaleString("es-CL")} CLP en egresos y ${top.count} movimientos en el rango consultado.`
          : "Te conviene revisar clasificación o ampliar el rango si esperabas más datos.",
        recommendations: top
          ? [`Si buscas ahorro, empieza auditando ${top.categoryName}, porque es donde hoy se concentra más gasto.`]
          : [],
        keyFindings: summary.slice(0, 3).map((item) => `${item.categoryName}: ${item.expenses.toLocaleString("es-CL")} CLP`),
        dataUsed: buildGenericDataUsed(scope, [`Categorías evaluadas: ${summary.length}.`])
      };

      return {
        intent: resolved.intent,
        question: input.question,
        scope,
        answer: await buildNarrativeAnswer({
          provider,
          settings: settings.aiSettings,
          baseAnswer: "Distribución financiera por categoría.",
          question: input.question,
          contextData: summary,
          sections
        }),
        data: summary,
        source: "internal_analytics",
        nextSuggestedQuestions: ["¿Qué categoría subió más?", "¿Qué categoría puedo optimizar?"],
        interpretedQuery: resolved.extracted,
        sections
      };
    }
    case "personal_money_in_business": {
      const result = await getPersonalMoneyUsedInBusiness(resolved.filters);
      const topUnit = result.byBusinessUnit[0];
      const sections: FinancialAISection = {
        summary:
          result.total > 0
            ? `Detecté uso de dinero personal en empresas por ${result.total.toLocaleString("es-CL")} CLP.`
            : "No detecté uso de dinero personal en empresas dentro del rango consultado.",
        explanation:
          topUnit
            ? `${topUnit.businessUnitName} concentra la mayor parte de ese monto con ${topUnit.total.toLocaleString("es-CL")} CLP.`
            : "No hubo suficiente desglose por unidad para profundizar más.",
        recommendations:
          result.total > 0
            ? ["Conviene monitorear este indicador mes a mes y cruzarlo con reembolsos pendientes para no distorsionar tu caja personal."]
            : [],
        keyFindings: result.byBusinessUnit.slice(0, 3).map((item) => `${item.businessUnitName}: ${item.total.toLocaleString("es-CL")} CLP`),
        dataUsed: buildGenericDataUsed(scope, [`Movimientos reembolsables analizados: ${result.count}.`])
      };

      return {
        intent: resolved.intent,
        question: input.question,
        scope,
        answer: await buildNarrativeAnswer({
          provider,
          settings: settings.aiSettings,
          baseAnswer: "Monto de dinero personal utilizado para gastos empresariales.",
          question: input.question,
          contextData: result,
          sections
        }),
        data: result,
        source: "internal_analytics",
        nextSuggestedQuestions: [
          "¿Qué negocio me debe más reembolso?",
          "¿Cómo evolucionó este monto por mes?"
        ],
        interpretedQuery: resolved.extracted,
        sections
      };
    }
    case "monthly_trend": {
      const trend = await getMonthlyTrend(resolved.filters, { months: 12 });
      const peakExpenseMonth = [...trend].sort((left, right) => right.expenses - left.expenses)[0];
      const bestNetMonth = [...trend].sort((left, right) => right.net - left.net)[0];
      const sections: FinancialAISection = {
        summary: `Preparé una lectura de tendencia mensual con ${trend.length} puntos históricos.`,
        explanation: [
          peakExpenseMonth
            ? `El mes con mayor egreso fue ${peakExpenseMonth.month}.`
            : "",
          bestNetMonth ? `El mejor flujo neto se observó en ${bestNetMonth.month}.` : ""
        ]
          .filter(Boolean)
          .join(" "),
        recommendations: [
          "Úsalo para identificar meses estacionales, revisar desvíos y anticipar presión de caja."
        ],
        keyFindings: trend.slice(-4).map((item) => `${item.month}: neto ${item.net.toLocaleString("es-CL")} CLP`),
        dataUsed: buildGenericDataUsed(scope, [`Meses considerados: ${trend.length}.`])
      };

      return {
        intent: resolved.intent,
        question: input.question,
        scope,
        answer: await buildNarrativeAnswer({
          provider,
          settings: settings.aiSettings,
          baseAnswer: "Tendencia mensual de ingresos y egresos.",
          question: input.question,
          contextData: trend,
          sections
        }),
        data: trend,
        source: "internal_analytics",
        nextSuggestedQuestions: [
          "¿Cuál fue el mejor mes en flujo neto?",
          "¿En qué mes subieron más los egresos?"
        ],
        interpretedQuery: resolved.extracted,
        sections
      };
    }
    case "transactions_lookup": {
      const tx = await listTransactions({
        ...resolved.filters,
        search: resolved.filters.search ?? input.question,
        take: input.limit ?? 20
      });
      const sections: FinancialAISection = {
        summary: `Encontré ${tx.items.length} movimientos relacionados con tu consulta.`,
        explanation:
          tx.items.length > 0
            ? `La búsqueda se armó usando texto, filtros interpretados y el contexto del workspace activo.`
            : "No hubo resultados con los filtros y el texto interpretado actualmente.",
        recommendations:
          tx.items.length > 0
            ? ["Si quieres una lectura más útil, puedo resumir estos movimientos por categoría, negocio o período."]
            : ["Prueba ampliar el rango de fechas o usar una descripción más cercana a la glosa bancaria."],
        keyFindings: tx.items.slice(0, 5).map((item) => item.description),
        dataUsed: buildGenericDataUsed(scope, [`Movimientos devueltos: ${tx.items.length}.`])
      };

      return {
        intent: resolved.intent,
        question: input.question,
        scope,
        answer: await buildNarrativeAnswer({
          provider,
          settings: settings.aiSettings,
          baseAnswer: "Movimientos relacionados con la consulta.",
          question: input.question,
          contextData: tx.items,
          sections
        }),
        data: tx,
        source: "internal_analytics",
        nextSuggestedQuestions: [
          "¿Quieres un resumen por categoría de estos movimientos?",
          "¿Deseas filtrar por un rango de fechas?"
        ],
        interpretedQuery: resolved.extracted,
        sections
      };
    }
    case "insights": {
      const insights = await getAutomaticInsights(resolved.filters, {
        insightParameters: asInsightParameters(settings.aiSettings.insightParameters)
      });
      const sections: FinancialAISection = {
        summary:
          insights.length > 0
            ? `Detecté ${insights.length} insights relevantes en tus datos reales.`
            : "No detecté alertas importantes con los parámetros actuales.",
        explanation:
          insights.length > 0
            ? `Los insights consideran histórico reciente, cambios de período, concentración y uso de dinero personal en empresas.`
            : "Puedes ajustar umbrales en Configuración > IA si quieres una sensibilidad mayor.",
        recommendations:
          insights.length > 0
            ? ["Prioriza primero los insights críticos o de warning, porque son los que más afectan claridad operativa y caja."]
            : ["Si quieres, puedo hacer un análisis más profundo para encontrar oportunidades de ahorro y patrones negativos."],
        keyFindings: insights.map((item) => item.title),
        dataUsed: buildGenericDataUsed(scope, [`Insights generados: ${insights.length}.`])
      };

      return {
        intent: resolved.intent,
        question: input.question,
        scope,
        answer: await buildNarrativeAnswer({
          provider,
          settings: settings.aiSettings,
          baseAnswer: "Insights automáticos detectados en tus datos financieros.",
          question: input.question,
          contextData: insights,
          sections
        }),
        data: insights,
        source: "internal_analytics",
        nextSuggestedQuestions: [
          "¿Cómo corrijo el principal riesgo detectado?",
          "¿Qué métrica debería vigilar semanalmente?"
        ],
        interpretedQuery: resolved.extracted,
        sections
      };
    }
    case "overview":
    default: {
      const overview = await getFinancialOverview(resolved.filters);
      const sections: FinancialAISection = {
        summary: "Preparé un resumen financiero consolidado usando solo datos verificados de la app.",
        explanation: `En el período consultado hay ${overview.incomes.toLocaleString("es-CL")} CLP en ingresos, ${overview.expenses.toLocaleString(
          "es-CL"
        )} CLP en egresos y un flujo neto de ${overview.net.toLocaleString("es-CL")} CLP.`,
        recommendations: [
          "Si quieres una respuesta más accionable, puedo explicar qué categoría o negocio está impulsando más este resultado."
        ],
        keyFindings: [`Movimientos considerados: ${overview.count}`],
        dataUsed: buildGenericDataUsed(scope, [`Total de movimientos: ${overview.count}.`])
      };

      return {
        intent: "overview",
        question: input.question,
        scope,
        answer: await buildNarrativeAnswer({
          provider,
          settings: settings.aiSettings,
          baseAnswer: "Resumen financiero general del período consultado.",
          question: input.question,
          contextData: overview,
          sections
        }),
        data: overview,
        source: "internal_analytics",
        nextSuggestedQuestions: [
          "¿Cómo se divide esto por negocio?",
          "¿Qué categoría explica más egresos?",
          "¿Qué cambió respecto al período anterior?"
        ],
        interpretedQuery: resolved.extracted,
        sections
      };
    }
  }
}
