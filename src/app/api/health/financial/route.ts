import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { getFinancialHealthSnapshot } from "@/server/services/financial-health-service";
import { dashboardFiltersSchema } from "@/shared/types/dashboard";

const querySchema = dashboardFiltersSchema.extend({
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

export async function GET(request: NextRequest) {
  try {
    const context = await getWorkspaceContextFromRequest(request);
    if (!context.workspaceId) {
      return NextResponse.json(
        { message: "No se pudo resolver el workspace activo." },
        { status: 400 }
      );
    }

    const rawQuery = {
      startDate: request.nextUrl.searchParams.get("startDate") ?? undefined,
      endDate: request.nextUrl.searchParams.get("endDate") ?? undefined,
      businessUnitId: request.nextUrl.searchParams.get("businessUnitId") ?? undefined,
      categoryId: request.nextUrl.searchParams.get("categoryId") ?? undefined,
      financialOrigin: request.nextUrl.searchParams.get("financialOrigin") ?? undefined,
      reviewStatus: request.nextUrl.searchParams.get("reviewStatus") ?? undefined
    };

    const filters = querySchema.parse(rawQuery);
    const response = await getFinancialHealthSnapshot({
      workspaceId: context.workspaceId,
      userKey: context.userKey ?? undefined,
      filters
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "Filtros inválidos para la salud financiera.",
          issues: error.issues
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: "No se pudo cargar la salud financiera."
      },
      { status: 500 }
    );
  }
}
