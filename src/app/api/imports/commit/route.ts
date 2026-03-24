import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { requireRoutePermission } from "@/server/permissions/route-permissions";
import { getAuthSessionFromRequest } from "@/server/auth/session";
import { commitImportedTransactions } from "@/server/services/import-service";

export async function POST(request: NextRequest) {
  const access = await requireRoutePermission(request, "transactions:import");
  if (!access.ok) {
    return access.response;
  }

  try {
    const authSession = await getAuthSessionFromRequest(request);
    const payload = await request.json();

    const result = await commitImportedTransactions({
      workspaceId: access.context.workspaceId,
      userKey: access.context.userKey,
      sessionId: authSession?.id,
      payload
    });

    return NextResponse.json({
      message: "Importacion finalizada.",
      summary: result
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "Payload invalido para importar movimientos.",
          issues: error.issues
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "No se pudo completar la importacion."
      },
      { status: 500 }
    );
  }
}

