import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";

const querySchema = z.object({
  kind: z.enum(["person", "company"])
});

export async function GET(
  request: NextRequest,
  { params }: { params: { debtorId: string } }
) {
  try {
    const context = await getWorkspaceContextFromRequest(request);
    if (!context.workspaceId) {
      return NextResponse.json(
        { message: "No se pudo resolver el workspace activo." },
        { status: 400 }
      );
    }

    const query = querySchema.parse({
      kind: request.nextUrl.searchParams.get("kind") ?? undefined
    });

    throw new Error("PDF export temporalmente deshabilitado");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "Parámetros inválidos para exportar la deuda.",
          issues: error.issues
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: "No se pudo generar el PDF de la deuda."
      },
      { status: 500 }
    );
  }
}
