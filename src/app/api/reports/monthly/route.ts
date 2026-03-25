import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRoutePermission } from "@/server/permissions/route-permissions";
import { buildMonthlyReportBundle } from "@/server/services/monthly-report-service";
import { dashboardFiltersSchema } from "@/shared/types/dashboard";

const requestSchema = z.object({
  filters: dashboardFiltersSchema.default({})
});

export async function POST(request: NextRequest) {
  const access = await requireRoutePermission(request, "reports:export");
  if (!access.ok) {
    return access.response;
  }

  try {
    const json = await request.json().catch(() => ({}));
    const payload = requestSchema.parse(json);
    const bundle = await buildMonthlyReportBundle({
      workspaceId: access.context.workspaceId,
      filters: payload.filters
    });

    return new NextResponse(new Uint8Array(bundle.buffer), {
      status: 200,
      headers: {
        "Content-Type": bundle.contentType,
        "Content-Disposition": `attachment; filename="${bundle.fileName}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Payload inválido para reporte mensual.", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "No se pudo generar el reporte mensual." },
      { status: 500 }
    );
  }
}
