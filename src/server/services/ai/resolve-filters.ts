import type { TransactionFilterInput } from "@/server/query-builders/transaction-query-builder";
import type { LLMInterpretedQuery } from "@/server/services/ai-provider";
import { findBusinessUnitByName, listBusinessUnits } from "@/server/repositories/business-unit-repository";
import { findCategoryByName, listCategories } from "@/server/repositories/category-repository";

export type ResolvedAIQuery = {
  intent: LLMInterpretedQuery["intent"];
  filters: TransactionFilterInput;
  extracted: {
    businessUnitName?: string;
    categoryName?: string;
    confidence?: number;
  };
  availableContext: {
    businessUnits: string[];
    categories: string[];
  };
};

export async function getAvailableAIContext(workspaceId: string) {
  const [businessUnits, categories] = await Promise.all([
    listBusinessUnits(workspaceId),
    listCategories(workspaceId)
  ]);

  return {
    businessUnits,
    categories
  };
}

export async function resolveAIQueryFilters(input: {
  interpreted: LLMInterpretedQuery;
  workspaceId: string;
  baseFilters?: TransactionFilterInput;
}) {
  const [businessUnit, category, available] = await Promise.all([
    input.interpreted.businessUnitName
      ? findBusinessUnitByName(input.interpreted.businessUnitName, input.workspaceId)
      : Promise.resolve(null),
    input.interpreted.categoryName
      ? findCategoryByName(input.interpreted.categoryName, input.workspaceId)
      : Promise.resolve(null),
    getAvailableAIContext(input.workspaceId)
  ]);

  return {
    intent: input.interpreted.intent,
    filters: {
      ...input.baseFilters,
      workspaceId: input.workspaceId,
      businessUnitId: businessUnit?.id ?? input.baseFilters?.businessUnitId,
      categoryId: category?.id ?? input.baseFilters?.categoryId,
      financialOrigin: input.interpreted.financialOrigin ?? input.baseFilters?.financialOrigin,
      type: input.interpreted.transactionType ?? input.baseFilters?.type,
      search: input.interpreted.searchText ?? input.baseFilters?.search,
      startDate: input.interpreted.dateRange?.startDate
        ? new Date(input.interpreted.dateRange.startDate)
        : input.baseFilters?.startDate,
      endDate: input.interpreted.dateRange?.endDate
        ? new Date(input.interpreted.dateRange.endDate)
        : input.baseFilters?.endDate
    },
    extracted: {
      businessUnitName: input.interpreted.businessUnitName,
      categoryName: input.interpreted.categoryName,
      confidence: input.interpreted.confidence
    },
    availableContext: {
      businessUnits: available.businessUnits.map((item) => item.name),
      categories: available.categories.map((item) => item.name)
    }
  };
}
