import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { upsertUserDashboardFilters } from "@/server/repositories/settings-repository";
import { dashboardFiltersSchema } from "@/shared/types/dashboard";

const dashboardPreferencesPayloadSchema = z.object({
  filters: dashboardFiltersSchema
});

export async function PATCH(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId || !context.userKey) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    const json = await request.json();
    const payload = dashboardPreferencesPayloadSchema.parse(json);

    await upsertUserDashboardFilters(context.workspaceId, context.userKey, payload.filters);

    return NextResponse.json({
      message: "Preferencias del dashboard actualizadas.",
      filters: payload.filters
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Preferencias invalidas para dashboard.", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "No se pudieron guardar las preferencias del dashboard." },
      { status: 500 }
    );
  }
}
