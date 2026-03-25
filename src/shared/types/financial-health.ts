import { z } from "zod";
import { financialInsightAlertSchema, financialInsightHormigaSchema } from "@/shared/types/financial-insights";
import { dashboardKpiComparisonSchema } from "@/shared/types/dashboard";

export const financialHealthStatusSchema = z.enum(["saludable", "atencion", "critico"]);

export const financialHealthFactorSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  tone: z.enum(["success", "warning", "danger", "neutral"])
});

export const financialHealthTimelineSchema = z.object({
  debtId: z.string(),
  debtName: z.string(),
  reason: z.string(),
  dueDate: z.string(),
  amount: z.number(),
  health: z.enum(["AL_DIA", "PROXIMA", "VENCIDA", "PAGADA"]),
  daysUntilDue: z.number()
});

export const financialHealthResponseSchema = z.object({
  status: financialHealthStatusSchema,
  score: z.number(),
  headline: z.string(),
  summary: z.string(),
  periodLabel: z.string(),
  metrics: z.object({
    savings: z.number(),
    expenseComparison: dashboardKpiComparisonSchema,
    topExpenseCategory: z
      .object({
        name: z.string(),
        amount: z.number(),
        percentage: z.number()
      })
      .nullable(),
    committedDebtAmount: z.number(),
    committedDebtPct: z.number(),
    overdueCount: z.number(),
    upcomingCount: z.number(),
    activeInstallmentDebts: z.number(),
    hormigaCount: z.number(),
    alertCount: z.number()
  }),
  factors: z.array(financialHealthFactorSchema),
  alerts: z.array(financialInsightAlertSchema),
  gastosHormiga: z.array(financialInsightHormigaSchema),
  upcomingTimeline: z.array(financialHealthTimelineSchema)
});

export type FinancialHealthStatus = z.infer<typeof financialHealthStatusSchema>;
export type FinancialHealthFactor = z.infer<typeof financialHealthFactorSchema>;
export type FinancialHealthTimelineItem = z.infer<typeof financialHealthTimelineSchema>;
export type FinancialHealthResponse = z.infer<typeof financialHealthResponseSchema>;
