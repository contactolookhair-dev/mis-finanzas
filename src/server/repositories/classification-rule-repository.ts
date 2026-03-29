import { prisma } from "@/server/db/prisma";
import type { ClassificationRulePayload } from "@/shared/types/classification-rules";

const LEARNED_RULE_PREFIX = "Auto (historial):";

function normalizeKeyword(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function deriveMerchantKeyword(merchant: string) {
  const normalized = normalizeKeyword(merchant);
  if (!normalized) return null;

  // Avoid learning from placeholders or extremely generic strings.
  const blocked = new Set(["movimiento", "compra", "pago", "abono", "transferencia", "cargo"]);
  const tokens = normalized.split(" ").filter(Boolean);
  const meaningful = tokens.filter((t) => t.length >= 3 && !blocked.has(t));

  if (meaningful.length === 0) return null;

  // Prefer a short stable key that matches "contains" variants (uber, copec, mercadopago, etc).
  // Use 1-2 tokens to reduce overfitting.
  const primary = meaningful[0]!;
  const secondary = meaningful[1];
  const keyword = secondary && primary.length <= 4 ? `${primary} ${secondary}` : primary;
  return keyword.trim().slice(0, 64);
}

export async function listClassificationRules(workspaceId: string) {
  return prisma.classificationRule.findMany({
    where: { workspaceId },
    include: {
      category: { select: { id: true, name: true } },
      businessUnit: { select: { id: true, name: true } }
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }]
  });
}

export async function createClassificationRule(workspaceId: string, payload: ClassificationRulePayload) {
  return prisma.classificationRule.create({
    data: {
      workspaceId,
      ...payload,
      categoryId: payload.categoryId ?? null,
      businessUnitId: payload.businessUnitId ?? null,
      financialOrigin: payload.financialOrigin ?? null,
      isReimbursable: typeof payload.isReimbursable === "boolean" ? payload.isReimbursable : null
    }
  });
}

export async function updateClassificationRule(
  workspaceId: string,
  ruleId: string,
  payload: ClassificationRulePayload
) {
  const existing = await prisma.classificationRule.findFirst({
    where: { id: ruleId, workspaceId },
    select: { id: true }
  });
  if (!existing) {
    throw new Error("Regla no encontrada para este workspace.");
  }

  return prisma.classificationRule.update({
    where: { id: existing.id },
    data: {
      ...payload,
      categoryId: payload.categoryId ?? null,
      businessUnitId: payload.businessUnitId ?? null,
      financialOrigin: payload.financialOrigin ?? null,
      isReimbursable: typeof payload.isReimbursable === "boolean" ? payload.isReimbursable : null
    }
  });
}

export async function listRulesForEngine(workspaceId: string) {
  return prisma.classificationRule.findMany({
    where: {
      workspaceId,
      isActive: true
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }]
  });
}

export async function upsertLearnedMerchantCategoryRule(
  workspaceId: string,
  input: { merchant: string; categoryId: string }
) {
  const keyword = deriveMerchantKeyword(input.merchant);
  if (!keyword) {
    throw new Error("Merchant no es suficientemente específico para aprender una categoría.");
  }

  const existing = await prisma.classificationRule.findFirst({
    where: {
      workspaceId,
      keyword,
      matchField: "DESCRIPCION",
      matchMode: "PARTIAL",
      name: { startsWith: LEARNED_RULE_PREFIX }
    },
    select: { id: true }
  });

  const payload: ClassificationRulePayload = {
    name: `${LEARNED_RULE_PREFIX} ${keyword}`,
    keyword,
    priority: 950,
    matchField: "DESCRIPCION",
    matchMode: "PARTIAL",
    categoryId: input.categoryId,
    isActive: true
  };

  if (existing?.id) {
    return prisma.classificationRule.update({
      where: { id: existing.id },
      data: {
        ...payload,
        categoryId: payload.categoryId ?? null,
        businessUnitId: payload.businessUnitId ?? null,
        financialOrigin: payload.financialOrigin ?? null,
        isReimbursable: typeof payload.isReimbursable === "boolean" ? payload.isReimbursable : null
      }
    });
  }

  return prisma.classificationRule.create({
    data: {
      workspaceId,
      ...payload,
      categoryId: payload.categoryId ?? null,
      businessUnitId: payload.businessUnitId ?? null,
      financialOrigin: payload.financialOrigin ?? null,
      isReimbursable: typeof payload.isReimbursable === "boolean" ? payload.isReimbursable : null
    }
  });
}
