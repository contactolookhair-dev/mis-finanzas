import { z } from "zod";

export const dashboardFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  businessUnitId: z.string().optional(),
  categoryId: z.string().optional(),
  financialOrigin: z.enum(["PERSONAL", "EMPRESA"]).optional(),
  reviewStatus: z.enum(["PENDIENTE", "REVISADO", "OBSERVADO"]).optional()
});

export const dashboardKpiComparisonSchema = z.object({
  current: z.number(),
  previous: z.number(),
  delta: z.number(),
  deltaPct: z.number()
});

export const dashboardComparisonMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  current: z.number(),
  previous: z.number(),
  delta: z.number(),
  deltaPct: z.number()
});

export const dashboardSnapshotSchema = z.object({
  filters: dashboardFiltersSchema,
  references: z.object({
    businessUnits: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string()
      })
    ),
    categories: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string()
      })
    )
  }),
  kpis: z.object({
    netFlow: z.number(),
    incomes: z.number(),
    expenses: z.number(),
    personalMoneyInBusiness: z.number(),
    receivables: z.number(),
    totalTransactions: z.number(),
    reviewedTransactions: z.number(),
    reviewedRatio: z.number()
  }),
  comparisons: z.object({
    currentPeriodLabel: z.string(),
    previousPeriodLabel: z.string(),
    incomes: dashboardKpiComparisonSchema,
    expenses: dashboardKpiComparisonSchema,
    netFlow: dashboardKpiComparisonSchema,
    personalMoneyInBusiness: dashboardKpiComparisonSchema,
    receivables: dashboardKpiComparisonSchema,
    chart: z.array(dashboardComparisonMetricSchema)
  }),
  charts: z.object({
    trend: z.array(
      z.object({
        month: z.string(),
        ingresos: z.number(),
        egresos: z.number(),
        neto: z.number()
      })
    ),
    categories: z.array(
      z.object({
        name: z.string(),
        value: z.number(),
        count: z.number()
      })
    ),
    businessUnits: z.array(
      z.object({
        name: z.string(),
        value: z.number(),
        count: z.number()
      })
    ),
    originMix: z.array(
      z.object({
        name: z.string(),
        value: z.number()
      })
    )
  }),
  insights: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      severity: z.enum(["info", "warning", "critical"])
    })
  ),
  recentTransactions: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      description: z.string(),
      amount: z.number(),
      type: z.enum(["INGRESO", "EGRESO"]),
      category: z.string(),
      businessUnit: z.string(),
      reviewStatus: z.string()
    })
  ),
  importActivity: z.array(
    z.object({
      id: z.string(),
      createdAt: z.string(),
      userKey: z.string(),
      summary: z.record(z.unknown()).nullable()
    })
  )
});

export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>;
export type DashboardSnapshot = z.infer<typeof dashboardSnapshotSchema>;
export type DashboardKpiComparison = z.infer<typeof dashboardKpiComparisonSchema>;
