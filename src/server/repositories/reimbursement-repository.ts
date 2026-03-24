import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

export async function listReimbursements(workspaceId: string) {
  return prisma.reimbursement.findMany({
    where: { workspaceId },
    include: {
      businessUnit: true,
      personalAccount: true,
      transaction: true
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }]
  });
}

type SyncReimbursementInput = {
  workspaceId: string;
  transactionId: string;
  businessUnitId: string;
  amount: number;
  personalAccountId?: string | null;
  notes?: string | null;
};

export async function upsertPendingReimbursementForTransaction(
  input: SyncReimbursementInput,
  db: PrismaClient | Prisma.TransactionClient = prisma
) {
  return db.reimbursement.upsert({
    where: {
      transactionId: input.transactionId
    },
    create: {
      workspaceId: input.workspaceId,
      transactionId: input.transactionId,
      businessUnitId: input.businessUnitId,
      personalAccountId: input.personalAccountId ?? null,
      amount: input.amount,
      notes: input.notes ?? undefined
    },
    update: {
      workspaceId: input.workspaceId,
      businessUnitId: input.businessUnitId,
      personalAccountId: input.personalAccountId ?? null,
      amount: input.amount,
      notes: input.notes ?? undefined
    }
  });
}

export async function deleteReimbursementByTransactionId(
  transactionId: string,
  db: PrismaClient | Prisma.TransactionClient = prisma
) {
  const existing = await db.reimbursement.findFirst({
    where: { transactionId }
  });

  if (!existing) {
    return null;
  }

  return db.reimbursement.delete({
    where: { id: existing.id }
  });
}
