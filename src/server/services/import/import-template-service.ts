import type { ImportParserKind } from "@/shared/types/imports";
import {
  importTemplateColumnsSchema,
  importTemplatePayloadSchema,
  type ImportTemplate,
  type ImportTemplatePayload
} from "@/shared/types/import-templates";
import {
  createWorkspaceImportTemplateConfig,
  deleteWorkspaceImportTemplateConfig,
  findWorkspaceImportTemplateConfig,
  listWorkspaceImportTemplateConfigs,
  updateWorkspaceImportTemplateConfig
} from "@/server/repositories/import-template-repository";
import { listSystemImportTemplates } from "@/server/services/import/import-templates";

function sourceRank(template: ImportTemplate) {
  return template.sourceType === "workspace" ? 1 : 0;
}

function sortTemplates(left: ImportTemplate, right: ImportTemplate) {
  const sourceDifference = sourceRank(right) - sourceRank(left);
  if (sourceDifference !== 0) {
    return sourceDifference;
  }

  if (left.detectionPriority !== right.detectionPriority) {
    return right.detectionPriority - left.detectionPriority;
  }

  return left.name.localeCompare(right.name, "es");
}

function mapStoredTemplate(row: Awaited<ReturnType<typeof listWorkspaceImportTemplateConfigs>>[number]): ImportTemplate {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    institution: row.institution,
    parser: row.parser.toLowerCase() as ImportParserKind,
    sourceType: "workspace",
    isSystem: row.isSystem,
    isActive: row.isActive,
    detectionPriority: row.detectionPriority,
    filenameHints: Array.isArray(row.filenameHints) ? row.filenameHints.filter((value): value is string => typeof value === "string") : [],
    headerHints: Array.isArray(row.headerHints) ? row.headerHints.filter((value): value is string => typeof value === "string") : [],
    columns: importTemplateColumnsSchema.parse(row.columnMappings),
    dateFormats: Array.isArray(row.dateFormats) ? row.dateFormats.filter((value): value is string => typeof value === "string") : [],
    amountMode: row.amountMode,
    hasBalance: row.hasBalance,
    notes: row.notes ?? null
  };
}

export async function listWorkspaceAwareImportTemplates(input: {
  workspaceId: string;
  parser?: ImportParserKind;
  includeInactive?: boolean;
}) {
  const [workspaceTemplates, systemTemplates] = await Promise.all([
    listWorkspaceImportTemplateConfigs(input.workspaceId),
    Promise.resolve(listSystemImportTemplates(input.parser))
  ]);

  const mappedWorkspaceTemplates = workspaceTemplates
    .map(mapStoredTemplate)
    .filter((template) => !input.parser || template.parser === input.parser)
    .filter((template) => input.includeInactive || template.isActive);

  const mappedSystemTemplates = systemTemplates
    .filter((template) => input.includeInactive || template.isActive)
    .map((template) => ({
      ...template,
      sourceType: "system" as const,
      isSystem: true
    }));

  return [...mappedWorkspaceTemplates, ...mappedSystemTemplates].sort(sortTemplates);
}

export async function getImportTemplateForWorkspace(input: {
  workspaceId: string;
  templateId: string;
  parser?: ImportParserKind;
  includeInactive?: boolean;
}) {
  const templates = await listWorkspaceAwareImportTemplates({
    workspaceId: input.workspaceId,
    parser: input.parser,
    includeInactive: input.includeInactive
  });

  return templates.find((template) => template.id === input.templateId) ?? null;
}

export async function createWorkspaceImportTemplate(workspaceId: string, payload: ImportTemplatePayload) {
  const parsed = importTemplatePayloadSchema.parse(payload);
  const created = await createWorkspaceImportTemplateConfig(workspaceId, parsed);
  return mapStoredTemplate(created);
}

export async function updateWorkspaceImportTemplate(
  workspaceId: string,
  templateId: string,
  payload: ImportTemplatePayload
) {
  const parsed = importTemplatePayloadSchema.parse(payload);
  const updated = await updateWorkspaceImportTemplateConfig(workspaceId, templateId, parsed);
  return mapStoredTemplate(updated);
}

export async function deleteWorkspaceImportTemplate(workspaceId: string, templateId: string) {
  await deleteWorkspaceImportTemplateConfig(workspaceId, templateId);
}

export async function duplicateImportTemplateToWorkspace(workspaceId: string, templateId: string) {
  const template = await getImportTemplateForWorkspace({
    workspaceId,
    templateId,
    includeInactive: true
  });

  if (!template) {
    throw new Error("No se encontro la plantilla a duplicar.");
  }

  return createWorkspaceImportTemplate(workspaceId, {
    name: `Copia de ${template.name}`,
    institution: template.institution,
    parser: template.parser,
    detectionPriority: template.detectionPriority,
    filenameHints: template.filenameHints,
    headerHints: template.headerHints,
    columns: template.columns,
    dateFormats: template.dateFormats,
    amountMode: template.amountMode,
    hasBalance: template.hasBalance,
    isActive: true,
    notes: template.notes ?? null
  });
}

export async function getEditableWorkspaceImportTemplate(workspaceId: string, templateId: string) {
  const template = await findWorkspaceImportTemplateConfig(workspaceId, templateId);
  return template ? mapStoredTemplate(template) : null;
}
