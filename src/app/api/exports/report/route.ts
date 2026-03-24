import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRoutePermission } from "@/server/permissions/route-permissions";
import { generateExportBundle } from "@/server/services/export-service";
import { exportRequestSchema } from "@/shared/types/exports";

export async function POST(request: NextRequest) {
  const access = await requireRoutePermission(request, "reports:export");
  if (!access.ok) {
    return access.response;
  }

  try {
    const json = await request.json();
    const payload = exportRequestSchema.parse(json);
    const bundle = await generateExportBundle({
      workspaceId: access.context.workspaceId,
      format: payload.format,
      reportType: payload.reportType,
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
        { message: "Payload inválido para exportación.", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "No se pudo generar el reporte exportable." },
      { status: 500 }
    );
  }
}
