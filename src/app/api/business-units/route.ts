import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { BusinessUnitType } from "@prisma/client";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { createBusinessUnit, listBusinessUnits } from "@/server/repositories/business-unit-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(2),
  type: z.nativeEnum(BusinessUnitType).optional()
});

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId || !context.userKey) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  const units = await listBusinessUnits(context.workspaceId);
  return NextResponse.json({
    items: units.map((u) => ({ id: u.id, name: u.name, type: u.type }))
  });
}

export async function POST(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId || !context.userKey) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    const payload = createSchema.parse((await request.json()) as unknown);
    const created = await createBusinessUnit({
      workspaceId: context.workspaceId,
      name: payload.name,
      type: payload.type ?? BusinessUnitType.NEGOCIO
    });

    return NextResponse.json({
      item: { id: created.id, name: created.name, type: created.type }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Datos inválidos.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo crear el negocio." },
      { status: 500 }
    );
  }
}

