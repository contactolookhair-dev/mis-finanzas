import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createManualCategory,
  listManualCategories
} from "@/server/services/manual-catalog-service";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

const createCategorySchema = z.object({
  name: z.string().min(2)
});

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId && DEV_MODE) {
    return NextResponse.json({ items: [] });
  }
  if (!context.workspaceId || (!context.userKey && !DEV_MODE)) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  const items = await listManualCategories(context.workspaceId);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId && DEV_MODE) {
    return NextResponse.json(
      { message: "No se pudo resolver el contexto de trabajo." },
      { status: 400 }
    );
  }
  if (!context.workspaceId || (!context.userKey && !DEV_MODE)) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    const payload = createCategorySchema.parse((await request.json()) as unknown);
    await createManualCategory(context.workspaceId, payload.name);
    const items = await listManualCategories(context.workspaceId);
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Datos invalidos para crear categoria.", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "No se pudo crear la categoria." }, { status: 500 });
  }
}
