import { prisma } from "@/server/db/prisma";
import type { ClassificationRulePayload } from "@/shared/types/classification-rules";

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
