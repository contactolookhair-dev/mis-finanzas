import { z } from "zod";
import type { AIProvider, LLMInterpretedQuery } from "@/server/services/ai-provider";

export const aiIntentSchema = z.enum([
  "overview",
  "analysis",
  "by_business_unit",
  "by_category",
  "personal_money_in_business",
  "monthly_trend",
  "transactions_lookup",
  "insights"
]);

export type AIIntent = z.infer<typeof aiIntentSchema>;

function parseRelativeDateRange(question: string) {
  const normalized = question.toLowerCase();
  const now = new Date();

  if (normalized.includes("este mes")) {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
    };
  }

  if (normalized.includes("mes pasado") || normalized.includes("mes anterior")) {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      endDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    };
  }

  if (normalized.includes("hoy")) {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
      endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
    };
  }

  return undefined;
}

export function detectIntentFromRules(question: string): AIIntent {
  const normalized = question.toLowerCase();

  if (
    normalized.includes("por que") ||
    normalized.includes("por qué") ||
    normalized.includes("que cambio") ||
    normalized.includes("qué cambió") ||
    normalized.includes("patron") ||
    normalized.includes("patrón") ||
    normalized.includes("ahorrar") ||
    normalized.includes("reducir") ||
    normalized.includes("consumiendo mas caja") ||
    normalized.includes("consumiendo más caja") ||
    normalized.includes("se me esta yendo") ||
    normalized.includes("se me está yendo")
  ) {
    return "analysis";
  }
  if (normalized.includes("categoria")) return "by_category";
  if (normalized.includes("negocio") || normalized.includes("unidad")) return "by_business_unit";
  if (
    normalized.includes("puse") ||
    normalized.includes("personal") ||
    normalized.includes("reembolso")
  ) {
    return "personal_money_in_business";
  }
  if (normalized.includes("tendencia") || normalized.includes("evolucion") || normalized.includes("mes")) {
    return "monthly_trend";
  }
  if (normalized.includes("movimiento") || normalized.includes("detalle") || normalized.includes("transaccion")) {
    return "transactions_lookup";
  }
  if (normalized.includes("alerta") || normalized.includes("insight")) return "insights";

  return "overview";
}

function matchNameInQuestion(question: string, names: string[]) {
  const normalized = question.toLowerCase();
  return names.find((name) => normalized.includes(name.toLowerCase()));
}

export function fallbackInterpret(question: string, businessUnits: string[], categories: string[]): LLMInterpretedQuery {
  const normalized = question.toLowerCase();
  const transactionType = normalized.includes("gaste") || normalized.includes("egreso")
    ? "EGRESO"
    : normalized.includes("ingreso") || normalized.includes("vendi")
      ? "INGRESO"
      : undefined;

  return {
    intent: detectIntentFromRules(question),
    dateRange: parseRelativeDateRange(question),
    businessUnitName: matchNameInQuestion(question, businessUnits),
    categoryName: matchNameInQuestion(question, categories),
    transactionType,
    financialOrigin: normalized.includes("personal")
      ? "PERSONAL"
      : normalized.includes("empresa")
        ? "EMPRESA"
        : undefined,
    searchText: question,
    confidence: 0.45
  };
}

function shouldFallbackToAI(interpreted: LLMInterpretedQuery) {
  switch (interpreted.intent) {
    case "overview":
      return true;
    case "monthly_trend":
      return !interpreted.dateRange && !interpreted.businessUnitName && !interpreted.categoryName;
    case "by_category":
      return !interpreted.categoryName;
    case "by_business_unit":
      return !interpreted.businessUnitName;
    case "personal_money_in_business":
      return !interpreted.businessUnitName && !interpreted.financialOrigin;
    case "transactions_lookup":
      return !interpreted.searchText || interpreted.searchText.trim().length < 4;
    case "analysis":
    case "insights":
      return false;
    default:
      return true;
  }
}

export async function interpretFinancialQuery(input: {
  provider: AIProvider;
  question: string;
  systemPrompt?: string;
  tone?: string;
  detailLevel?: string;
  businessUnits: string[];
  categories: string[];
}) {
  const ruleBased = fallbackInterpret(input.question, input.businessUnits, input.categories);

  if (!shouldFallbackToAI(ruleBased)) {
    return ruleBased;
  }

  try {
    const interpreted = await input.provider.interpret({
      systemPrompt: input.systemPrompt,
      question: input.question,
      tone: input.tone,
      detailLevel: input.detailLevel,
      businessUnits: input.businessUnits,
      categories: input.categories,
      nowIso: new Date().toISOString()
    });

    if (interpreted && !shouldFallbackToAI(interpreted)) {
      return interpreted;
    }
  } catch {
    // Fallback silencioso a reglas locales para mantener disponibilidad.
  }

  return ruleBased;
}
