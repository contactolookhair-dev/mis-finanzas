import { z } from "zod";

export const financialInsightCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number(),
  percentage: z.number(),
  count: z.number()
});

export const financialInsightHormigaSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: z.string(),
  amount: z.number(),
  average: z.number(),
  count: z.number()
});

export const financialInsightAlertSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  severity: z.enum(["info", "warning", "critical"])
});

export const financialInsightRecommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(["high", "medium", "low"])
});

export const financialInsightsPeriodSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  label: z.string()
});

export const financialInsightsResponseSchema = z.object({
  summary: z.string(),
  topCategories: z.array(financialInsightCategorySchema),
  gastosHormiga: z.array(financialInsightHormigaSchema),
  alerts: z.array(financialInsightAlertSchema),
  recommendations: z.array(financialInsightRecommendationSchema),
  period: financialInsightsPeriodSchema,
  model: z.string(),
  source: z.enum(["gemini", "fallback"])
});

export type FinancialInsightCategory = z.infer<typeof financialInsightCategorySchema>;
export type FinancialInsightHormiga = z.infer<typeof financialInsightHormigaSchema>;
export type FinancialInsightAlert = z.infer<typeof financialInsightAlertSchema>;
export type FinancialInsightRecommendation = z.infer<typeof financialInsightRecommendationSchema>;
export type FinancialInsightsPeriod = z.infer<typeof financialInsightsPeriodSchema>;
export type FinancialInsightsResponse = z.infer<typeof financialInsightsResponseSchema>;
