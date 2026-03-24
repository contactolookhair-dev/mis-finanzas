import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  buildTransactionOrderBy,
  buildTransactionWhere,
  type TransactionFilterInput,
  type TransactionOrderInput
} from "@/server/query-builders/transaction-query-builder";

const DEFAULT_TAKE = 50;
const MAX_TAKE = 200;

export type ListTransactionsParams = TransactionFilterInput & {
  take?: number;
  skip?: number;
  cursor?: string;
  order?: TransactionOrderInput;
};

export type ListTransactionsResult = {
  items: Prisma.TransactionGetPayload<{
    include: {
      account: true;
      category: true;
      subcategory: true;
      businessUnit: true;
    };
  }>[];
  pageInfo: {
    hasNextPage: boolean;
    nextCursor: string | null;
    take: number;
  };
};

export type CreateTransactionInput = Prisma.TransactionUncheckedCreateInput;
export type UpdateTransactionInput = Prisma.TransactionUncheckedUpdateInput;

function normalizeTake(take?: number) {
  if (!take) return DEFAULT_TAKE;
  return Math.min(Math.max(1, take), MAX_TAKE);
}

function getTransactionInclude() {
  return {
    account: true,
    category: true,
    subcategory: true,
    businessUnit: true
  } satisfies Prisma.TransactionInclude;
}

export async function listTransactions(params: ListTransactionsParams = {}): Promise<ListTransactionsResult> {
  const take = normalizeTake(params.take);
  const where = buildTransactionWhere(params);
  const orderBy = buildTransactionOrderBy(params.order);

  const rows = await prisma.transaction.findMany({
    where,
    include: getTransactionInclude(),
    orderBy,
    take: take + 1,
    skip: params.cursor ? 1 : (params.skip ?? 0),
    cursor: params.cursor ? { id: params.cursor } : undefined
  });

  const hasNextPage = rows.length > take;
  const items = hasNextPage ? rows.slice(0, take) : rows;
  const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null;

  return {
    items,
    pageInfo: {
      hasNextPage,
      nextCursor,
      take
    }
  };
}

export async function createTransaction(
  data: CreateTransactionInput,
  db: PrismaClient | Prisma.TransactionClient = prisma
) {
  return db.transaction.create({
    data,
    include: getTransactionInclude()
  });
}

export async function updateTransaction(
  id: string,
  data: UpdateTransactionInput,
  db: PrismaClient | Prisma.TransactionClient = prisma
) {
  return db.transaction.update({
    where: { id },
    data,
    include: getTransactionInclude()
  });
}

export async function getTransactionById(id: string) {
  return prisma.transaction.findUnique({
    where: { id },
    include: getTransactionInclude()
  });
}

export async function findTransactionsByFingerprints(workspaceId: string, fingerprints: string[]) {
  if (fingerprints.length === 0) {
    return [];
  }

  return prisma.transaction.findMany({
    where: {
      workspaceId,
      duplicateFingerprint: {
        in: fingerprints
      }
    },
    select: {
      id: true,
      duplicateFingerprint: true,
      description: true,
      date: true,
      amount: true
    }
  });
}

export async function listRecentClassifiedTransactions(workspaceId: string, take = 400) {
  return prisma.transaction.findMany({
    where: {
      workspaceId
    },
    select: {
      id: true,
      description: true,
      categoryId: true,
      businessUnitId: true,
      financialOrigin: true,
      type: true,
      isReimbursable: true,
      isBusinessPaidPersonally: true,
      updatedAt: true
    },
    orderBy: { updatedAt: "desc" },
    take
  });
}

export async function listTransactionsForExport(params: TransactionFilterInput = {}) {
  return prisma.transaction.findMany({
    where: buildTransactionWhere(params),
    include: getTransactionInclude(),
    orderBy: buildTransactionOrderBy({ field: "date", direction: "desc" })
  });
}
