import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { getDashboardSnapshot } from "@/server/services/dashboard-service";
import { dashboardFiltersSchema, type DashboardFilters, type DashboardSnapshot } from "@/shared/types/dashboard";

const dashboardQuerySchema = dashboardFiltersSchema.extend({
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

function getFallbackDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 29);
  const toString = (value: Date) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, "0");
    const day = `${value.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  return { startDate: toString(start), endDate: toString(end) };
}

function buildEmptySnapshot(filters: DashboardFilters = {}): DashboardSnapshot {
  const fallback = getFallbackDateRange();
  const resolvedFilters: DashboardFilters = {
    ...filters,
    startDate: filters.startDate ?? fallback.startDate,
    endDate: filters.endDate ?? fallback.endDate
  };
  const label = `${resolvedFilters.startDate ?? fallback.startDate} → ${resolvedFilters.endDate ?? fallback.endDate}`;

  return {
    filters: resolvedFilters,
    references: {
      businessUnits: [],
      categories: []
    },
    kpis: {
      netFlow: 0,
      incomes: 0,
      expenses: 0,
      personalMoneyInBusiness: 0,
      receivables: 0,
      totalTransactions: 0,
      reviewedTransactions: 0,
      reviewedRatio: 0
    },
    comparisons: {
      currentPeriodLabel: label,
      previousPeriodLabel: label,
      incomes: { current: 0, previous: 0, delta: 0, deltaPct: 0 },
      expenses: { current: 0, previous: 0, delta: 0, deltaPct: 0 },
      netFlow: { current: 0, previous: 0, delta: 0, deltaPct: 0 },
      personalMoneyInBusiness: { current: 0, previous: 0, delta: 0, deltaPct: 0 },
      receivables: { current: 0, previous: 0, delta: 0, deltaPct: 0 },
      chart: []
    },
    charts: {
      trend: [],
      categories: [],
      businessUnits: [],
      originMix: []
    },
    insights: [],
    recentTransactions: [],
    importActivity: []
  };
}

export async function GET(request: NextRequest) {
  const isDev = process.env.ENABLE_DEV_AUTH_LOGIN === "true";
  console.log("Dashboard DEV MODE:", isDev);

  const rawQuery = {
    startDate: request.nextUrl.searchParams.get("startDate") ?? undefined,
    endDate: request.nextUrl.searchParams.get("endDate") ?? undefined,
    businessUnitId: request.nextUrl.searchParams.get("businessUnitId") ?? undefined,
    categoryId: request.nextUrl.searchParams.get("categoryId") ?? undefined,
    financialOrigin: request.nextUrl.searchParams.get("financialOrigin") ?? undefined,
    reviewStatus: request.nextUrl.searchParams.get("reviewStatus") ?? undefined
  };

  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId || !context.userKey) {
    if (isDev) {
      const fallbackFilters = dashboardQuerySchema.safeParse(rawQuery);
      return NextResponse.json(buildEmptySnapshot(fallbackFilters.success ? fallbackFilters.data : {}));
    }
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    const query = dashboardQuerySchema.parse(rawQuery);
    const hasExplicitFilters = Object.values(rawQuery).some((value) => value !== undefined);

    const snapshot = await getDashboardSnapshot(
      context.workspaceId,
      hasExplicitFilters ? query : {},
      { userKey: context.userKey }
    );
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Filtros invalidos para dashboard.", issues: error.issues },
        { status: 400 }
      );
    }

    if (isDev) {
      const fallbackFilters = dashboardQuerySchema.safeParse(rawQuery);
      return NextResponse.json(buildEmptySnapshot(fallbackFilters.success ? fallbackFilters.data : {}));
    }

    return NextResponse.json({ message: "No se pudo cargar el dashboard." }, { status: 500 });
  }
}
