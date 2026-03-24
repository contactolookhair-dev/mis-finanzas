import { Prisma, type FinancialOrigin, type TransactionType } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  createTransaction,
  listTransactions,
  updateTransaction,
  type CreateTransactionInput,
  type ListTransactionsParams,
  type UpdateTransactionInput
} from "@/server/repositories/transaction-repository";
import {
  deleteReimbursementByTransactionId,
  upsertPendingReimbursementForTransaction
} from "@/server/repositories/reimbursement-repository";
import {
  getSummaryByBusinessUnit as getSummaryByBusinessUnitAnalytics,
  getSummaryByCategory as getSummaryByCategoryAnalytics,
  getMonthlyTrend as getMonthlyTrendAnalytics
} from "@/server/services/analytics-service";
import { toAmountNumber } from "@/server/lib/amounts";

function shouldCreateReimbursement(transaction: {
  isBusinessPaidPersonally: boolean;
  businessUnitId?: string | null;
  type: TransactionType;
}) {
  return (
    transaction.isBusinessPaidPersonally &&
    transaction.type === "EGRESO" &&
    typeof transaction.businessUnitId === "string" &&
    transaction.businessUnitId.length > 0
  );
}

async function syncTransactionReimbursement(
  transaction: {
    id: string;
    workspaceId: string;
    businessUnitId?: string | null;
    accountId?: string | null;
    amount: Prisma.Decimal;
    isBusinessPaidPersonally: boolean;
    type: TransactionType;
    description: string;
  },
  db: Prisma.TransactionClient
) {
  if (!shouldCreateReimbursement(transaction)) {
    await deleteReimbursementByTransactionId(transaction.id, db);
    return;
  }

  await upsertPendingReimbursementForTransaction(
    {
      workspaceId: transaction.workspaceId,
      transactionId: transaction.id,
      businessUnitId: transaction.businessUnitId!,
      personalAccountId: transaction.accountId ?? null,
      amount: Math.abs(toAmountNumber(transaction.amount)),
      notes: `Auto-generado desde transacción: ${transaction.description}`
    },
    db
  );
}

export async function createTransactionWithAutomation(
  input: CreateTransactionInput,
  db?: Prisma.TransactionClient
) {
  if (db) {
    const transaction = await createTransaction(input, db);
    await syncTransactionReimbursement(transaction, db);
    return transaction;
  }

  return prisma.$transaction(async (db) => {
    const transaction = await createTransaction(input, db);
    await syncTransactionReimbursement(transaction, db);
    return transaction;
  });
}

export async function updateTransactionWithAutomation(id: string, input: UpdateTransactionInput) {
  return prisma.$transaction(async (db) => {
    const transaction = await updateTransaction(id, input, db);
    await syncTransactionReimbursement(transaction, db);
    return transaction;
  });
}

export async function getTransactionSummaryByOrigin(origin?: FinancialOrigin) {
  const transactionPage = await listTransactions({
    financialOrigin: origin,
    take: 200
  });

  const totals = transactionPage.items.reduce(
    (acc, transaction) => {
      const amount = toAmountNumber(transaction.amount);
      if (transaction.type === "INGRESO") {
        acc.income += Math.abs(amount);
      } else {
        acc.expense += Math.abs(amount);
      }
      acc.net = acc.income - acc.expense;
      return acc;
    },
    { income: 0, expense: 0, net: 0 }
  );

  return {
    totals,
    count: transactionPage.items.length,
    pageInfo: transactionPage.pageInfo
  };
}

export async function getSummaryByBusinessUnit(params: ListTransactionsParams = {}) {
  return getSummaryByBusinessUnitAnalytics(params);
}

export async function getSummaryByCategory(params: ListTransactionsParams = {}) {
  return getSummaryByCategoryAnalytics(params);
}

export async function getMonthlyTrend(params: ListTransactionsParams = {}) {
  return getMonthlyTrendAnalytics(params);
}
