import { NextRequest, NextResponse } from "next/server";
import { requireRoutePermission } from "@/server/permissions/route-permissions";
import { clearDemoData } from "@/server/services/demo-data-service";

export async function DELETE(request: NextRequest) {
  const access = await requireRoutePermission(request, "settings:edit");
  if (!access.ok) {
    return access.response;
  }

  try {
    const result = await clearDemoData(access.context.workspaceId);
    return NextResponse.json({ message: "Datos demo eliminados.", result });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudieron eliminar los datos demo." },
      { status: 500 }
    );
  }
}
