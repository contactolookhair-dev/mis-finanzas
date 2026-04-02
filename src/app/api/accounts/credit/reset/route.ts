import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { resetWorkspaceCreditCardSnapshots } from "@/server/services/manual-accounts-service";
import type { Prisma } from "@prisma/client";
import { AccountType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

function isObj(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
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

  // 1) Clear AppSettings snapshots (creditCardSummaryByAccountId + per-account operational snapshot).
  const cleared = await resetWorkspaceCreditCardSnapshots(context.workspaceId);

  let deleteTransactions = false;
  try {
    // Optional body: { deleteTransactions: boolean }
    const body = (await request.json()) as unknown;
    if (body && typeof body === "object" && "deleteTransactions" in (body as Record<string, unknown>)) {
      deleteTransactions = (body as Record<string, unknown>).deleteTransactions === true;
    }
  } catch {
    // If there is no JSON body (common), keep default.
  }

  let deletedTransactions = 0;
  let deletedReimbursements = 0;

  if (deleteTransactions) {
    const creditAccounts = await prisma.account.findMany({
      where: { workspaceId: context.workspaceId, type: AccountType.TARJETA_CREDITO },
      select: { id: true }
    });
    const creditAccountIds = creditAccounts.map((a) => a.id);

    if (creditAccountIds.length > 0) {
      const creditTransactionIds = (
        await prisma.transaction.findMany({
          where: { workspaceId: context.workspaceId, accountId: { in: creditAccountIds } },
          select: { id: true }
        })
      ).map((t) => t.id);

      if (creditTransactionIds.length > 0) {
        const reimbursementsResult = await prisma.reimbursement.deleteMany({
          where: { workspaceId: context.workspaceId, transactionId: { in: creditTransactionIds } }
        });
        deletedReimbursements = reimbursementsResult.count ?? 0;

        const txResult = await prisma.transaction.deleteMany({
          where: { workspaceId: context.workspaceId, accountId: { in: creditAccountIds } }
        });
        deletedTransactions = txResult.count ?? 0;
      }
    }
  }

  // 2) Also clear imported statement snapshots stored on import batches (keeps transactions intact).
  // This avoids credit-health endpoints showing old statement summaries after a reset.
  const batches = await prisma.importBatch.findMany({
    where: {
      workspaceId: context.workspaceId,
      status: "COMPLETED",
      parser: "PDF"
    },
    orderBy: [{ createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      metadata: true
    }
  });

  let statementBatchesCleared = 0;
  for (const batch of batches) {
    if (!isObj(batch.metadata)) continue;
    const meta = batch.metadata as Record<string, unknown>;
    if (!("creditCardStatement" in meta)) continue;
    if (!meta.creditCardStatement) continue;

    const nextMeta = { ...meta, creditCardStatement: null };
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { metadata: nextMeta as unknown as Prisma.InputJsonValue }
    });
    statementBatchesCleared += 1;
  }

  return NextResponse.json({
    success: true,
    cleared,
    statementBatchesCleared,
    deleteTransactions,
    deletedTransactions,
    deletedReimbursements
  });
}
