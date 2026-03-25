import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { buildFinancialInsights } from "@/server/services/financial-insights-service";
import { dashboardFiltersSchema } from "@/shared/types/dashboard";

const requestSchema = z
  .object({
    filters: dashboardFiltersSchema.optional()
  })
  .optional();

export async function POST(request: NextRequest) {
  try {
    const context = await getWorkspaceContextFromRequest(request);
    if (!context.workspaceId) {
      return NextResponse.json(
        { message: "No se pudo resolver el workspace activo." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const payload = requestSchema.parse(body);

    const response = await buildFinancialInsights({
      workspaceId: context.workspaceId,
      filters: payload?.filters ?? {}
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "Payload inválido para el análisis de IA financiera.",
          issues: error.issues
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: "No fue posible generar el análisis de IA financiera."
      },
      { status: 500 }
    );
  }
}
