import { z } from "zod";

export const importedTransactionTypeSchema = z.enum(["INGRESO", "EGRESO"]);
export const importedFinancialOriginSchema = z.enum(["PERSONAL", "EMPRESA"]);
export const importParserKindSchema = z.enum(["csv", "xlsx", "pdf"]);
export const importDuplicateStatusSchema = z.enum(["none", "existing", "batch"]);
export const suggestionSourceKindSchema = z.enum(["rule", "history", "detected", "manual"]);

export const importFieldSuggestionSchema = z.object({
  source: suggestionSourceKindSchema,
  label: z.string(),
  confidence: z.number().min(0).max(1).optional()
});

export const importPreviewRowSchema = z.object({
  id: z.string(),
  rowNumber: z.number().int().min(1),
  date: z.string().optional(),
  description: z.string().default(""),
  amount: z.number().finite().optional(),
  type: importedTransactionTypeSchema.optional(),
  balance: z.number().finite().nullable().optional(),
  sourceAccountName: z.string().optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  businessUnitId: z.string().optional(),
  financialOrigin: importedFinancialOriginSchema.default("PERSONAL"),
  isReimbursable: z.boolean().default(false),
  isBusinessPaidPersonally: z.boolean().default(false),
  duplicateFingerprint: z.string().optional(),
  duplicateStatus: importDuplicateStatusSchema.default("none"),
  suggestionMeta: z
    .object({
      categoryId: importFieldSuggestionSchema.optional(),
      businessUnitId: importFieldSuggestionSchema.optional(),
      financialOrigin: importFieldSuggestionSchema.optional(),
      type: importFieldSuggestionSchema.optional(),
      isReimbursable: importFieldSuggestionSchema.optional(),
      isBusinessPaidPersonally: importFieldSuggestionSchema.optional()
    })
    .default({}),
  issues: z.array(z.string()).default([]),
  include: z.boolean().default(true),
  rawValues: z.record(z.unknown()).default({})
});

export const importCommitRowSchema = z.object({
  id: z.string(),
  rowNumber: z.number().int().min(1),
  date: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().finite(),
  type: importedTransactionTypeSchema,
  balance: z.number().finite().nullable().optional(),
  sourceAccountName: z.string().optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  businessUnitId: z.string().optional(),
  financialOrigin: importedFinancialOriginSchema,
  isReimbursable: z.boolean().default(false),
  isBusinessPaidPersonally: z.boolean().default(false),
  duplicateFingerprint: z.string().optional(),
  duplicateStatus: importDuplicateStatusSchema.default("none"),
  suggestionMeta: z
    .object({
      categoryId: importFieldSuggestionSchema.optional(),
      businessUnitId: importFieldSuggestionSchema.optional(),
      financialOrigin: importFieldSuggestionSchema.optional(),
      type: importFieldSuggestionSchema.optional(),
      isReimbursable: importFieldSuggestionSchema.optional(),
      isBusinessPaidPersonally: importFieldSuggestionSchema.optional()
    })
    .optional(),
  issues: z.array(z.string()).default([]),
  include: z.boolean().default(true)
});

export const importCommitPayloadSchema = z.object({
  parser: importParserKindSchema,
  fileName: z.string().min(1),
  rows: z.array(importCommitRowSchema)
});

export type ImportPreviewRow = z.infer<typeof importPreviewRowSchema>;
export type ImportCommitRow = z.infer<typeof importCommitRowSchema>;
export type ImportCommitPayload = z.infer<typeof importCommitPayloadSchema>;
export type ImportParserKind = z.infer<typeof importParserKindSchema>;
export type ImportDuplicateStatus = z.infer<typeof importDuplicateStatusSchema>;
export type ImportFieldSuggestion = z.infer<typeof importFieldSuggestionSchema>;
