import { z } from "zod";

export const categoryMonthlyItemSchema = z.object({
  categoryId: z.string().nullable(),
  categoryName: z.string(),
  total: z.number().finite(),
  percentage: z.number().finite(),
  count: z.number().int().min(0),
  previousTotal: z.number().finite(),
  delta: z.number().finite(),
  deltaPct: z.number().finite()
});

export const categoryMonthlyAnalyticsResponseSchema = z.object({
  month: z.string(),
  previousMonth: z.string(),
  totalExpenses: z.number().finite(),
  items: z.array(categoryMonthlyItemSchema)
});

export type CategoryMonthlyAnalyticsResponse = z.infer<typeof categoryMonthlyAnalyticsResponseSchema>;

