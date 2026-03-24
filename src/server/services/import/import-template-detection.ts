import type { ImportParserKind } from "@/shared/types/imports";
import type { ImportTemplate } from "@/shared/types/import-templates";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function countHeaderMatches(headers: string[], template: ImportTemplate) {
  const normalizedHeaders = headers.map((header) => normalizeText(header));
  let matches = 0;

  for (const hint of template.headerHints) {
    const normalizedHint = normalizeText(hint);
    if (normalizedHeaders.some((header) => header.includes(normalizedHint))) {
      matches += 1;
    }
  }

  return matches;
}

function countFilenameMatches(fileName: string, template: ImportTemplate) {
  const normalized = normalizeText(fileName);
  return template.filenameHints.filter((hint) => normalized.includes(normalizeText(hint))).length;
}

export function detectImportTemplate(input: {
  parser?: ImportParserKind;
  fileName: string;
  headers: string[];
  templates: ImportTemplate[];
  selectedTemplateId?: string;
}) {
  const templates = input.parser
    ? input.templates.filter((template) => template.parser === input.parser)
    : input.templates;

  if (input.selectedTemplateId) {
    const selected = templates.find((template) => template.id === input.selectedTemplateId);
    if (selected) {
      return {
        detectedTemplate: selected,
        mode: "manual" as const,
        confidence: 1
      };
    }
  }

  let bestTemplate: ImportTemplate | null = null;
  let bestScore = -1;

  for (const template of templates) {
    const score =
      countHeaderMatches(input.headers, template) * 10 +
      countFilenameMatches(input.fileName, template) * 6 +
      (template.sourceType === "workspace" ? 2 : 0) +
      template.detectionPriority / 100;

    if (score > bestScore) {
      bestScore = score;
      bestTemplate = template;
    }
  }

  if (!bestTemplate || bestScore < 8) {
    const generic =
      templates.find((template) => template.institution === "Generico") ?? null;
    return {
      detectedTemplate: generic,
      mode: "generic" as const,
      confidence: generic ? 0.4 : 0
    };
  }

  return {
    detectedTemplate: bestTemplate,
    mode: "detected" as const,
    confidence: Math.min(bestScore / 20, 0.98)
  };
}
