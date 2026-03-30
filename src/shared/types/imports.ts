import { z } from "zod";

export const importedTransactionTypeSchema = z.enum(["INGRESO", "EGRESO"]);
export const importedFinancialOriginSchema = z.enum(["PERSONAL", "EMPRESA"]);
export const importParserKindSchema = z.enum(["csv", "xlsx", "pdf"]);
export const importDuplicateStatusSchema = z.enum(["none", "existing", "batch"]);
export const suggestionSourceKindSchema = z.enum(["rule", "history", "detected", "manual"]);
export const importClassificationSchema = z.enum(["PERSONAL", "NEGOCIO", "PRESTADO"]);

// Optional parser metadata for richer PDF imports (e.g. credit card statements).
// This is intentionally generic so other banks can plug in later without breaking the API.
export const importParserMetaSchema = z
  .object({
    kind: z.string().optional(),
    classifiedAs: z.string().optional(),
    section: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    confidence: z.number().min(0).max(1).optional(),
    rawLine: z.string().optional(),
    dubious: z.boolean().optional(),
    dubiousReasons: z.array(z.string()).optional()
  })
  .strict()
  .partial();

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
  classification: importClassificationSchema.optional(),
  debtorName: z.string().optional(),
  owedAmount: z.number().finite().optional(),
  isInstallmentDebt: z.boolean().optional(),
  installmentCount: z.number().int().min(0).optional(),
  installmentValue: z.number().finite().optional(),
  nextInstallmentDate: z.string().optional().nullable(),
  debtNote: z.string().optional().nullable(),
  parserMeta: importParserMetaSchema.optional(),
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
  rawValues: z.record(z.unknown()).default({}),

  // Credit card statement extras (Falabella/CMR and future banks).
  // Kept optional to avoid breaking existing CSV/XLSX imports and older data.
  descripcionBase: z.string().optional(),
  descriptionBase: z.string().optional(),
  esCompraEnCuotas: z.boolean().optional(),
  isInstallmentPurchase: z.boolean().optional(),
  cuotaActual: z.number().int().nullable().optional(),
  cuotaTotal: z.number().int().nullable().optional(),
  cuotasRestantes: z.number().int().nullable().optional(),
  montoCuota: z.number().finite().nullable().optional(),
  montoTotalCompra: z.number().finite().nullable().optional(),
  installments: z.number().int().nullable().optional(),
  installmentLabel: z.string().nullable().optional(),
  installmentLabelRaw: z.string().nullable().optional(),

  // Compatibility aliases used by the UI in some places.
  currentInstallment: z.number().int().nullable().optional(),
  totalInstallments: z.number().int().nullable().optional(),
  remainingInstallments: z.number().int().nullable().optional(),
  installmentAmount: z.number().finite().nullable().optional(),
  totalPurchaseAmount: z.number().finite().nullable().optional()
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
  classification: importClassificationSchema.optional(),
  debtorName: z.string().optional(),
  owedAmount: z.number().finite().optional(),
  isInstallmentDebt: z.boolean().optional(),
  installmentCount: z.number().int().min(0).optional(),
  installmentValue: z.number().finite().optional(),
  nextInstallmentDate: z.string().optional().nullable(),
  debtNote: z.string().optional().nullable(),
  parserMeta: importParserMetaSchema.optional(),
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
  include: z.boolean().default(true),

  // Credit card statement extras (Falabella/CMR and future banks).
  // Optional so existing commits (CSV/XLSX) stay compatible.
  descripcionBase: z.string().optional(),
  descriptionBase: z.string().optional(),
  esCompraEnCuotas: z.boolean().optional(),
  isInstallmentPurchase: z.boolean().optional(),
  cuotaActual: z.number().int().nullable().optional(),
  cuotaTotal: z.number().int().nullable().optional(),
  cuotasRestantes: z.number().int().nullable().optional(),
  montoCuota: z.number().finite().nullable().optional(),
  montoTotalCompra: z.number().finite().nullable().optional(),
  installments: z.number().int().nullable().optional(),
  installmentLabel: z.string().nullable().optional(),
  installmentLabelRaw: z.string().nullable().optional(),

  // Compatibility aliases used by the UI in some places.
  currentInstallment: z.number().int().nullable().optional(),
  totalInstallments: z.number().int().nullable().optional(),
  remainingInstallments: z.number().int().nullable().optional(),
  installmentAmount: z.number().finite().nullable().optional(),
  totalPurchaseAmount: z.number().finite().nullable().optional()
});

export const importCommitPayloadSchema = z.object({
  parser: importParserKindSchema,
  fileName: z.string().min(1),
  importType: z.enum(["credit", "account"]).optional(),
  accountId: z.string().optional(),
  rows: z.array(importCommitRowSchema),
  pdfMeta: z.record(z.unknown()).optional(),
  pdfWarnings: z.array(z.string()).optional(),
  appliedTemplateId: z.string().optional()
});

export type ImportPreviewRow = z.infer<typeof importPreviewRowSchema>;
export type ImportCommitRow = z.infer<typeof importCommitRowSchema>;
export type ImportCommitPayload = z.infer<typeof importCommitPayloadSchema>;
export type ImportParserKind = z.infer<typeof importParserKindSchema>;
export type ImportDuplicateStatus = z.infer<typeof importDuplicateStatusSchema>;
export type ImportFieldSuggestion = z.infer<typeof importFieldSuggestionSchema>;
export type ImportParserMeta = z.infer<typeof importParserMetaSchema>;
