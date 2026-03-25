import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { FinancialOrigin, TransactionType } from "@prisma/client";
import { toAmountNumber } from "@/server/lib/amounts";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { buildTransactionWhere } from "@/server/query-builders/transaction-query-builder";
import { BASE_TRANSACTION_MARKER } from "@/lib/constants/transactions";

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

  const workspaceId = context.workspaceId;

  const params = request.nextUrl.searchParams;
  const filters = {
    workspaceId,
    accountId: params.get("accountId") ?? undefined,
    categoryId: params.get("categoryId") ?? undefined,
    type: params.get("type") as "INGRESO" | "EGRESO" | undefined,
    startDate: parseSafeDate(params.get("startDate") ?? undefined),
    endDate: parseSafeDate(params.get("endDate") ?? undefined),
    search: params.get("search") ?? undefined
  };

  const where = buildTransactionWhere(filters);
  const sums = await prisma.transaction.groupBy({
    by: ["accountId"],
    where: {
      workspaceId,
      accountId: { not: null }
    },
    _sum: { amount: true }
  });

  await prisma.transaction.deleteMany({ where });

  const baseTransactions = sums
    .filter((row) => row.accountId)
    .map((row) => {
      const amount = toAmountNumber(row._sum.amount ?? 0);
      return {
        workspaceId,
        accountId: row.accountId!,
        amount,
        type: amount >= 0 ? TransactionType.INGRESO : TransactionType.EGRESO,
        date: new Date(),
        description: BASE_TRANSACTION_MARKER,
        financialOrigin: FinancialOrigin.PERSONAL,
        reviewStatus: "REVISADO" as const,
        notes: BASE_TRANSACTION_MARKER
      };
    })
    .filter((entry) => entry.amount !== 0);

  if (baseTransactions.length) {
    await prisma.transaction.createMany({ data: baseTransactions });
  }

  return NextResponse.json({ deleted: sums.length });
}
