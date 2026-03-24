import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRoutePermission } from "@/server/permissions/route-permissions";
import { getRecentSettingsAudits } from "@/server/services/admin-audit-service";

const querySchema = z.object({
  take: z.coerce.number().int().min(1).max(100).optional()
});

export async function GET(request: NextRequest) {
  const access = await requireRoutePermission(request, "settings:audit:view");
  if (!access.ok) {
    return access.response;
  }

  try {
    const parsed = querySchema.parse({
      take: request.nextUrl.searchParams.get("take") ?? undefined
    });
    const take = parsed.take ?? 20;
    const audits = await getRecentSettingsAudits(access.context.workspaceId, take);

    return NextResponse.json({
      items: audits.map((item) => ({
        id: item.id,
        section: item.section,
        action: item.action,
        userKey: item.userKey,
        sessionId: item.sessionId,
        createdAt: item.createdAt.toISOString(),
        changedFields: item.changedFields
      }))
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Parametros invalidos para historial.", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "No se pudo cargar el historial." }, { status: 500 });
  }
}

