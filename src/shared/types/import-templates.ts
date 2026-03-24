import { z } from "zod";

export const importAmountModeSchema = z.enum(["SIGNED", "SEPARATE_DEBIT_CREDIT"]);
export const importTemplateParserSchema = z.enum(["csv", "xlsx", "pdf"]);
export const importTemplateSourceSchema = z.enum(["system", "workspace"]);

export const importTemplateColumnsSchema = z.object({
  date: z.array(z.string()).default([]),
  description: z.array(z.string()).default([]),
  amount: z.array(z.string()).default([]),
  debit: z.array(z.string()).default([]),
  credit: z.array(z.string()).default([]),
  balance: z.array(z.string()).default([]),
  sourceAccountName: z.array(z.string()).default([]),
  type: z.array(z.string()).default([])
});

export const importTemplateSchema = z.object({
  id: z.string(),
  workspaceId: z.string().nullable().optional(),
  name: z.string(),
  institution: z.string(),
  parser: importTemplateParserSchema,
  sourceType: importTemplateSourceSchema.default("system"),
  isSystem: z.boolean().default(false),
  isActive: z.boolean().default(true),
  detectionPriority: z.number().int().default(0),
  filenameHints: z.array(z.string()).default([]),
  headerHints: z.array(z.string()).default([]),
  columns: importTemplateColumnsSchema,
  amountMode: importAmountModeSchema.default("SIGNED"),
  dateFormats: z.array(z.string()).default([]),
  hasBalance: z.boolean().default(false),
  notes: z.string().nullable().optional()
});

export const importTemplatePayloadSchema = z.object({
  name: z.string().trim().min(2, "Ingresa un nombre para la plantilla."),
  institution: z.string().trim().min(2, "Ingresa una institución o banco."),
  parser: importTemplateParserSchema,
  detectionPriority: z.number().int().min(0).max(999).default(50),
  filenameHints: z.array(z.string()).default([]),
  headerHints: z.array(z.string()).default([]),
  columns: importTemplateColumnsSchema,
  amountMode: importAmountModeSchema.default("SIGNED"),
  dateFormats: z.array(z.string()).default([]),
  hasBalance: z.boolean().default(false),
  isActive: z.boolean().default(true),
  notes: z.string().trim().max(500).nullable().optional()
});

export const importTemplateDuplicatePayloadSchema = z.object({
  duplicateFromTemplateId: z.string().min(1)
});

export type ImportTemplate = z.infer<typeof importTemplateSchema>;
export type ImportTemplatePayload = z.infer<typeof importTemplatePayloadSchema>;
export type ImportTemplateColumns = z.infer<typeof importTemplateColumnsSchema>;
export type ImportTemplateSource = z.infer<typeof importTemplateSourceSchema>;
export type ImportAmountMode = z.infer<typeof importAmountModeSchema>;
export type ImportTemplateParser = z.infer<typeof importTemplateParserSchema>;
