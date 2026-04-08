import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createManualAccount,
  listManualAccountsWithBalances
} from "@/server/services/manual-accounts-service";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { ACTIVE_WORKSPACE_COOKIE } from "@/server/auth/auth-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createAccountSchema = z.object({
  name: z.string().min(2),
  bank: z.string().optional().nullable(),
  type: z.enum(["CREDITO", "DEBITO", "EFECTIVO"]),
  openingBalance: z.coerce.number().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  appearanceMode: z.enum(["auto", "manual"]).optional(),
  creditLimit: z.coerce.number().optional(),
  closingDay: z.coerce.number().int().min(1).max(31).optional(),
  paymentDay: z.coerce.number().int().min(1).max(31).optional()
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
  const activeWorkspaceCookie = request.cookies.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
  console.log("accounts:post context", {
    workspaceId: context.workspaceId ?? null,
    source: context.source,
    userKey: context.userKey ?? null,
    hasActiveWorkspaceCookie: Boolean(activeWorkspaceCookie)
  });

  if (!context.workspaceId || !context.userKey) {
    console.log("accounts:post unauthorized", {
      reason: !context.userKey ? "missing_userKey" : "missing_workspaceId",
      source: context.source,
      hasActiveWorkspaceCookie: Boolean(activeWorkspaceCookie)
    });
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
      console.log("accounts:post validation-error", {
        issues: error.issues
      });
      return NextResponse.json(
        { message: "Datos invalidos para crear la cuenta.", issues: error.issues },
        { status: 400 }
      );
    }
    console.error("accounts:post error", {
      message: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json({ message: "No se pudo crear la cuenta." }, { status: 500 });
  }
}
