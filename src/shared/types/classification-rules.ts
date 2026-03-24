import { z } from "zod";

export const classificationRulePayloadSchema = z.object({
  name: z.string().min(2),
  keyword: z.string().min(2),
  priority: z.number().int().min(0).max(1000).default(0),
  matchField: z.enum(["DESCRIPCION", "NOTAS"]).default("DESCRIPCION"),
  matchMode: z.enum(["PARTIAL", "EXACT"]).default("PARTIAL"),
  categoryId: z.string().optional(),
  businessUnitId: z.string().optional(),
  financialOrigin: z.enum(["PERSONAL", "EMPRESA"]).optional(),
  isReimbursable: z.boolean().optional(),
  isActive: z.boolean().default(true)
});

export type ClassificationRulePayload = z.infer<typeof classificationRulePayloadSchema>;

