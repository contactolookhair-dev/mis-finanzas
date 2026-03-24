import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createManualAccount,
  listManualAccountsWithBalances
} from "@/server/services/manual-accounts-service";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";

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
  console.log("accounts:get context", {
    workspaceId: context.workspaceId ?? null,
    source: context.source,
    userKey: context.userKey ?? null
  });

  if (!context.workspaceId || !context.userKey) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  const items = await listManualAccountsWithBalances(context.workspaceId);
  console.log("accounts:get result", {
    workspaceId: context.workspaceId,
    count: items.length
  });
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  console.log("accounts:post context", {
    workspaceId: context.workspaceId ?? null,
    source: context.source,
    userKey: context.userKey ?? null
  });

  if (!context.workspaceId || !context.userKey) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    const payload = createAccountSchema.parse((await request.json()) as unknown);
    console.log("accounts:post payload", payload);
    const created = await createManualAccount({
      workspaceId: context.workspaceId,
      ...payload
    });
    console.log("accounts:post insert", {
      workspaceId: context.workspaceId,
      accountId: created.id,
      name: created.name
    });

    const items = await listManualAccountsWithBalances(context.workspaceId);
    console.log("accounts:post fetch-after-insert", {
      workspaceId: context.workspaceId,
      count: items.length
    });
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
