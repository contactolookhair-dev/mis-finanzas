import type { FinancialOrigin, TransactionType } from "@prisma/client";
import { listRulesForEngine } from "@/server/repositories/classification-rule-repository";
import { listRecentClassifiedTransactions } from "@/server/repositories/transaction-repository";
import type { ImportFieldSuggestion, ImportPreviewRow } from "@/shared/types/imports";

type FieldSuggestionMap = NonNullable<ImportPreviewRow["suggestionMeta"]>;

type ClassificationEngineContext = {
  rules: Awaited<ReturnType<typeof listRulesForEngine>>;
  history: Awaited<ReturnType<typeof listRecentClassifiedTransactions>>;
};

type ClassificationSuggestionResult = {
  categoryId?: string;
  businessUnitId?: string;
  financialOrigin?: FinancialOrigin;
  type?: TransactionType;
  isReimbursable?: boolean;
  isBusinessPaidPersonally?: boolean;
  suggestionMeta: FieldSuggestionMap;
};

const LEARNED_RULE_PREFIX = "Auto (historial):";

function isLearnedRule(rule: { name?: string }) {
  return typeof rule.name === "string" && rule.name.startsWith(LEARNED_RULE_PREFIX);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function setSuggestion(
  map: FieldSuggestionMap,
  field: keyof FieldSuggestionMap,
  value: ImportFieldSuggestion
) {
  if (!map[field]) {
    map[field] = value;
  }
}

function matchRule(description: string, keyword: string, matchMode: "PARTIAL" | "EXACT") {
  const normalizedDescription = normalizeText(description);
  const normalizedKeyword = normalizeText(keyword);

  if (!normalizedKeyword) return false;
  if (matchMode === "EXACT") {
    return normalizedDescription === normalizedKeyword;
  }
  return normalizedDescription.includes(normalizedKeyword);
}

function tokenSimilarity(left: string, right: string) {
  const leftTokens = new Set(normalizeText(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalizeText(right).split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

export async function getClassificationEngineContext(workspaceId: string): Promise<ClassificationEngineContext> {
  const [rules, history] = await Promise.all([
    listRulesForEngine(workspaceId),
    listRecentClassifiedTransactions(workspaceId)
  ]);

  return { rules, history };
}

export function suggestClassificationForRow(
  row: Pick<ImportPreviewRow, "description" | "type" | "financialOrigin">,
  context: ClassificationEngineContext
): ClassificationSuggestionResult {
  const suggestionMeta: FieldSuggestionMap = {};
  const description = row.description.trim();
  if (!description) {
    return { suggestionMeta };
  }

  const matchingRules = context.rules.filter((rule) =>
    matchRule(description, rule.keyword, rule.matchMode)
  );
  // Learned "merchant -> category" mappings are stored as rules but should behave like history
  // and take precedence over other rules/AI suggestions.
  const selectedRule = matchingRules.find((rule) => isLearnedRule(rule)) ?? matchingRules[0];

  const result: ClassificationSuggestionResult = {
    suggestionMeta
  };

  if (selectedRule) {
    if (selectedRule.categoryId) {
      result.categoryId = selectedRule.categoryId;
      setSuggestion(suggestionMeta, "categoryId", {
        source: isLearnedRule(selectedRule) ? "history" : "rule",
        label: isLearnedRule(selectedRule)
          ? "Categoría automática (basado en historial)"
          : `Regla: ${selectedRule.name}`,
        confidence: selectedRule.matchMode === "EXACT" ? 0.95 : isLearnedRule(selectedRule) ? 0.9 : 0.82
      });
    }
    if (selectedRule.businessUnitId) {
      result.businessUnitId = selectedRule.businessUnitId;
      setSuggestion(suggestionMeta, "businessUnitId", {
        source: isLearnedRule(selectedRule) ? "history" : "rule",
        label: isLearnedRule(selectedRule)
          ? "Unidad automática (basado en historial)"
          : `Regla: ${selectedRule.name}`,
        confidence: selectedRule.matchMode === "EXACT" ? 0.95 : isLearnedRule(selectedRule) ? 0.9 : 0.82
      });
    }
    if (selectedRule.financialOrigin) {
      result.financialOrigin = selectedRule.financialOrigin;
      setSuggestion(suggestionMeta, "financialOrigin", {
        source: isLearnedRule(selectedRule) ? "history" : "rule",
        label: isLearnedRule(selectedRule)
          ? "Origen automático (basado en historial)"
          : `Regla: ${selectedRule.name}`,
        confidence: selectedRule.matchMode === "EXACT" ? 0.92 : isLearnedRule(selectedRule) ? 0.88 : 0.78
      });
    }
    if (typeof selectedRule.isReimbursable === "boolean") {
      result.isReimbursable = selectedRule.isReimbursable;
      setSuggestion(suggestionMeta, "isReimbursable", {
        source: isLearnedRule(selectedRule) ? "history" : "rule",
        label: isLearnedRule(selectedRule)
          ? "Reembolsable (basado en historial)"
          : `Regla: ${selectedRule.name}`,
        confidence: isLearnedRule(selectedRule) ? 0.86 : 0.8
      });
      if (selectedRule.isReimbursable && selectedRule.financialOrigin === "EMPRESA") {
        result.isBusinessPaidPersonally = true;
        setSuggestion(suggestionMeta, "isBusinessPaidPersonally", {
          source: isLearnedRule(selectedRule) ? "history" : "rule",
          label: isLearnedRule(selectedRule)
            ? "Negocio pagado personalmente (basado en historial)"
            : `Regla: ${selectedRule.name}`,
          confidence: isLearnedRule(selectedRule) ? 0.86 : 0.8
        });
      }
    }
  }

  const bestHistorical = context.history
    .map((item) => ({
      item,
      similarity: tokenSimilarity(description, item.description)
    }))
    .filter((item) => item.similarity >= 0.55)
    .sort((left, right) => right.similarity - left.similarity)[0];

  if (bestHistorical) {
    if (!result.categoryId && bestHistorical.item.categoryId) {
      result.categoryId = bestHistorical.item.categoryId;
      setSuggestion(suggestionMeta, "categoryId", {
        source: "history",
        label: "Historico de clasificacion",
        confidence: Math.min(bestHistorical.similarity, 0.88)
      });
    }
    if (!result.businessUnitId && bestHistorical.item.businessUnitId) {
      result.businessUnitId = bestHistorical.item.businessUnitId;
      setSuggestion(suggestionMeta, "businessUnitId", {
        source: "history",
        label: "Historico de clasificacion",
        confidence: Math.min(bestHistorical.similarity, 0.88)
      });
    }
    if (!result.financialOrigin && bestHistorical.item.financialOrigin) {
      result.financialOrigin = bestHistorical.item.financialOrigin;
      setSuggestion(suggestionMeta, "financialOrigin", {
        source: "history",
        label: "Historico de clasificacion",
        confidence: Math.min(bestHistorical.similarity, 0.84)
      });
    }
    if (!result.type && bestHistorical.item.type) {
      result.type = bestHistorical.item.type;
      setSuggestion(suggestionMeta, "type", {
        source: "history",
        label: "Historico de clasificacion",
        confidence: Math.min(bestHistorical.similarity, 0.8)
      });
    }
    if (typeof result.isReimbursable !== "boolean" && bestHistorical.item.isReimbursable) {
      result.isReimbursable = bestHistorical.item.isReimbursable;
      setSuggestion(suggestionMeta, "isReimbursable", {
        source: "history",
        label: "Historico de clasificacion",
        confidence: Math.min(bestHistorical.similarity, 0.78)
      });
    }
    if (
      typeof result.isBusinessPaidPersonally !== "boolean" &&
      bestHistorical.item.isBusinessPaidPersonally
    ) {
      result.isBusinessPaidPersonally = bestHistorical.item.isBusinessPaidPersonally;
      setSuggestion(suggestionMeta, "isBusinessPaidPersonally", {
        source: "history",
        label: "Historico de clasificacion",
        confidence: Math.min(bestHistorical.similarity, 0.78)
      });
    }
  }

  return result;
}

export function applyClassificationSuggestions(
  rows: ImportPreviewRow[],
  context: ClassificationEngineContext
) {
  return rows.map((row) => {
    const suggestion = suggestClassificationForRow(row, context);
    // Preserve any upstream suggestions (e.g. AI/import heuristics) while letting
    // engine suggestions (rules/history) override the same field when present.
    const mergedSuggestionMeta = {
      ...(row.suggestionMeta ?? {}),
      ...(suggestion.suggestionMeta ?? {})
    };
    return {
      ...row,
      // Never overwrite values already provided by the file/template or set upstream.
      // Suggestions should fill gaps, not stomp user data.
      categoryId: row.categoryId ?? suggestion.categoryId,
      businessUnitId: row.businessUnitId ?? suggestion.businessUnitId,
      // For these, the row often contains defaults (e.g. PERSONAL) rather than user input,
      // so we allow the engine to override when it has a suggestion.
      financialOrigin: suggestion.financialOrigin ?? row.financialOrigin,
      type: suggestion.type ?? row.type,
      isReimbursable:
        typeof suggestion.isReimbursable === "boolean" ? suggestion.isReimbursable : row.isReimbursable,
      isBusinessPaidPersonally:
        typeof suggestion.isBusinessPaidPersonally === "boolean"
          ? suggestion.isBusinessPaidPersonally
          : row.isBusinessPaidPersonally,
      suggestionMeta: mergedSuggestionMeta
    };
  });
}
