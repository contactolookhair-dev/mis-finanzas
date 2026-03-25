import { NextRequest, NextResponse } from "next/server";
import { requireRoutePermission } from "@/server/permissions/route-permissions";
import { seedDemoData } from "@/server/services/demo-data-service";

export async function POST(request: NextRequest) {
  const access = await requireRoutePermission(request, "settings:edit");
  if (!access.ok) {
    return access.response;
  }

  try {
    const summary = await seedDemoData(access.context.workspaceId);
    return NextResponse.json({ message: "Datos de prueba cargados.", summary });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo cargar datos de prueba." },
      { status: 500 }
    );
  }
}
