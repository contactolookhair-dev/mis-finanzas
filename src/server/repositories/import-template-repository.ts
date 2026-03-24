import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { ImportTemplatePayload } from "@/shared/types/import-templates";

export async function listWorkspaceImportTemplateConfigs(workspaceId: string) {
  return prisma.importTemplateConfig.findMany({
    where: { workspaceId },
    orderBy: [{ detectionPriority: "desc" }, { createdAt: "asc" }]
  });
}

export async function findWorkspaceImportTemplateConfig(
  workspaceId: string,
  templateId: string
) {
  return prisma.importTemplateConfig.findFirst({
    where: {
      id: templateId,
      workspaceId
    }
  });
}

export async function createWorkspaceImportTemplateConfig(
  workspaceId: string,
  payload: ImportTemplatePayload
) {
  return prisma.importTemplateConfig.create({
    data: {
      workspaceId,
      name: payload.name,
      institution: payload.institution,
      parser: payload.parser.toUpperCase() as "CSV" | "XLSX" | "PDF",
      detectionPriority: payload.detectionPriority,
      filenameHints: payload.filenameHints as unknown as Prisma.InputJsonValue,
      headerHints: payload.headerHints as unknown as Prisma.InputJsonValue,
      columnMappings: payload.columns as unknown as Prisma.InputJsonValue,
      dateFormats: payload.dateFormats as unknown as Prisma.InputJsonValue,
      amountMode: payload.amountMode,
      hasBalance: payload.hasBalance,
      isActive: payload.isActive,
      isSystem: false,
      notes: payload.notes ?? null
    }
  });
}

export async function updateWorkspaceImportTemplateConfig(
  workspaceId: string,
  templateId: string,
  payload: ImportTemplatePayload
) {
  const existing = await findWorkspaceImportTemplateConfig(workspaceId, templateId);
  if (!existing) {
    throw new Error("Plantilla no encontrada para este workspace.");
  }

  return prisma.importTemplateConfig.update({
    where: { id: existing.id },
    data: {
      name: payload.name,
      institution: payload.institution,
      parser: payload.parser.toUpperCase() as "CSV" | "XLSX" | "PDF",
      detectionPriority: payload.detectionPriority,
      filenameHints: payload.filenameHints as unknown as Prisma.InputJsonValue,
      headerHints: payload.headerHints as unknown as Prisma.InputJsonValue,
      columnMappings: payload.columns as unknown as Prisma.InputJsonValue,
      dateFormats: payload.dateFormats as unknown as Prisma.InputJsonValue,
      amountMode: payload.amountMode,
      hasBalance: payload.hasBalance,
      isActive: payload.isActive,
      notes: payload.notes ?? null
    }
  });
}

export async function deleteWorkspaceImportTemplateConfig(workspaceId: string, templateId: string) {
  const existing = await findWorkspaceImportTemplateConfig(workspaceId, templateId);
  if (!existing) {
    throw new Error("Plantilla no encontrada para este workspace.");
  }

  await prisma.importTemplateConfig.delete({
    where: { id: existing.id }
  });
}
