import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { buildTransactionWhere } from "@/server/query-builders/transaction-query-builder";

function parseSafeDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}

export async function POST(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId || !context.userKey) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const filters = {
    workspaceId: context.workspaceId,
    accountId: params.get("accountId") ?? undefined,
    categoryId: params.get("categoryId") ?? undefined,
    type: params.get("type") as "INGRESO" | "EGRESO" | undefined,
    startDate: parseSafeDate(params.get("startDate") ?? undefined),
    endDate: parseSafeDate(params.get("endDate") ?? undefined),
    search: params.get("search") ?? undefined
  };

  const where = buildTransactionWhere(filters);
  const result = await prisma.transaction.deleteMany({ where });
  return NextResponse.json({ deleted: result.count });
}
