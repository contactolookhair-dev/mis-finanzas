import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { generateDebtPdfBundle } from "@/server/services/debt-pdf-service";

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

    const bundle = await generateDebtPdfBundle({
      workspaceId: context.workspaceId,
      debtId: params.debtorId,
      kind: query.kind
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
