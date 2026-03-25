import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  listManualAccountsWithBalances,
  resetAccountBaseTransaction,
  updateManualAccount
} from "@/server/services/manual-accounts-service";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

const updateAccountSchema = z.object({
  name: z.string().min(2).optional(),
  bank: z.string().optional().nullable(),
  type: z.enum(["CREDITO", "DEBITO", "EFECTIVO"]).optional(),
  isActive: z.boolean().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  currentBalance: z.number().optional(),
  appearanceMode: z.enum(["auto", "manual"]).optional(),
  creditLimit: z.number().optional(),
  closingDay: z.number().int().min(1).max(31).optional(),
  paymentDay: z.number().int().min(1).max(31).optional()
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
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
    const payload = updateAccountSchema.parse((await request.json()) as unknown);
    const updated = await updateManualAccount({
      workspaceId: context.workspaceId,
      accountId: params.accountId,
      ...payload
    });

    if (!updated) {
      return NextResponse.json({ message: "Cuenta no encontrada." }, { status: 404 });
    }

    if (payload.currentBalance !== undefined) {
      await resetAccountBaseTransaction({
        workspaceId: context.workspaceId,
        accountId: params.accountId,
        desiredBalance: payload.currentBalance
      });
    }

    const items = await listManualAccountsWithBalances(context.workspaceId);
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Datos invalidos para actualizar cuenta.", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "No se pudo actualizar la cuenta." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
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
    const updated = await updateManualAccount({
      workspaceId: context.workspaceId,
      accountId: params.accountId,
      isActive: false
    });

    if (!updated) {
      return NextResponse.json({ message: "Cuenta no encontrada." }, { status: 404 });
    }

    const items = await listManualAccountsWithBalances(context.workspaceId);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ message: "No se pudo eliminar la cuenta." }, { status: 500 });
  }
}
