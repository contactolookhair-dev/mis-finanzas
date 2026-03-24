import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createManualAccount,
  listManualAccountsWithBalances
} from "@/server/services/manual-accounts-service";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

const createAccountSchema = z.object({
  name: z.string().min(2),
  bank: z.string().optional().nullable(),
  type: z.enum(["CREDITO", "DEBITO", "EFECTIVO"]),
  openingBalance: z.coerce.number().optional(),
  color: z.string().optional(),
  icon: z.string().optional()
});

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId && DEV_MODE) {
    return NextResponse.json({ items: [] });
  }
  if (!context.workspaceId || (!context.userKey && !DEV_MODE)) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  const items = await listManualAccountsWithBalances(context.workspaceId);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId && DEV_MODE) {
    return NextResponse.json(
      { message: "Modo prueba activo sin workspace configurado." },
      { status: 400 }
    );
  }
  if (!context.workspaceId || (!context.userKey && !DEV_MODE)) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    const payload = createAccountSchema.parse((await request.json()) as unknown);
    await createManualAccount({
      workspaceId: context.workspaceId,
      ...payload
    });
    const items = await listManualAccountsWithBalances(context.workspaceId);
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Datos invalidos para crear la cuenta.", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "No se pudo crear la cuenta." }, { status: 500 });
  }
}
