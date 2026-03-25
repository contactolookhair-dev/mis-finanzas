import { NextRequest, NextResponse } from "next/server";
import { requireRoutePermission } from "@/server/permissions/route-permissions";
import { resetDemoData } from "@/server/services/demo-data-service";

export async function POST(request: NextRequest) {
  const access = await requireRoutePermission(request, "settings:edit");
  if (!access.ok) {
    return access.response;
  }

  try {
    const summary = await resetDemoData(access.context.workspaceId);
    return NextResponse.json({ message: "Datos demo reiniciados.", summary });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudieron reiniciar los datos demo." },
      { status: 500 }
    );
  }
}
