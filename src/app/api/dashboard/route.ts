import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { getDashboardSnapshot } from "@/server/services/dashboard-service";
import { dashboardFiltersSchema } from "@/shared/types/dashboard";

const dashboardQuerySchema = dashboardFiltersSchema.extend({
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

export async function GET(request: NextRequest) {
  const isDev = process.env.ENABLE_DEV_AUTH_LOGIN === "true";
  console.log("Dashboard DEV MODE:", isDev);

  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId || !context.userKey) {
    if (isDev) {
      return NextResponse.json(
        { message: "Modo desarrollo activo, pero no hay workspace disponible." },
        { status: 500 }
      );
    }
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    const rawQuery = {
      startDate: request.nextUrl.searchParams.get("startDate") ?? undefined,
      endDate: request.nextUrl.searchParams.get("endDate") ?? undefined,
      businessUnitId: request.nextUrl.searchParams.get("businessUnitId") ?? undefined,
      categoryId: request.nextUrl.searchParams.get("categoryId") ?? undefined,
      financialOrigin: request.nextUrl.searchParams.get("financialOrigin") ?? undefined,
      reviewStatus: request.nextUrl.searchParams.get("reviewStatus") ?? undefined
    };
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
    return NextResponse.json({ message: "No se pudo cargar el dashboard." }, { status: 500 });
  }
}
