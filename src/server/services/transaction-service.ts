import { AccountType, FinancialOrigin, Prisma, type TransactionType } from "@prisma/client";
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
  deleteOwnerDebtPayableForTransaction,
  upsertOwnerDebtPayableForTransaction
} from "@/server/repositories/payable-repository";
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

function shouldCreateOwnerDebtPayable(transaction: {
  account?: { type: AccountType } | null;
  accountId?: string | null;
  type: TransactionType;
  financialOrigin: FinancialOrigin;
  isReimbursable: boolean;
  isBusinessPaidPersonally: boolean;
}) {
  return (
    transaction.type === "EGRESO" &&
    transaction.financialOrigin === FinancialOrigin.PERSONAL &&
    !transaction.isReimbursable &&
    !transaction.isBusinessPaidPersonally &&
    transaction.account?.type === AccountType.TARJETA_CREDITO &&
    typeof transaction.accountId === "string" &&
    transaction.accountId.length > 0
  );
}

async function syncTransactionOwnerDebtPayable(
  transaction: {
    id: string;
    workspaceId: string;
    accountId?: string | null;
    account?: { type: AccountType; name: string } | null;
    amount: Prisma.Decimal;
    type: TransactionType;
    financialOrigin: FinancialOrigin;
    isReimbursable: boolean;
    isBusinessPaidPersonally: boolean;
    description: string;
    date: Date;
  },
  db: Prisma.TransactionClient
) {
  if (!shouldCreateOwnerDebtPayable(transaction)) {
    await deleteOwnerDebtPayableForTransaction(transaction.workspaceId, transaction.id, db);
    return;
  }

  const amount = Math.max(0, Math.abs(toAmountNumber(transaction.amount)));
  if (!Number.isFinite(amount) || amount <= 0) return;

  await upsertOwnerDebtPayableForTransaction(
    {
      workspaceId: transaction.workspaceId,
      transactionId: transaction.id,
      origin: `${transaction.account?.name ?? "Tarjeta"} · ${transaction.description}`,
      amount,
      // Due date is a best-effort default; user can edit. We keep it stable (transaction date).
      dueDate: new Date(transaction.date)
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
    await syncTransactionOwnerDebtPayable(transaction, db);
    return transaction;
  }

  return prisma.$transaction(async (db) => {
    const transaction = await createTransaction(input, db);
    await syncTransactionReimbursement(transaction, db);
    await syncTransactionOwnerDebtPayable(transaction, db);
    return transaction;
  });
}

export async function updateTransactionWithAutomation(id: string, input: UpdateTransactionInput) {
  return prisma.$transaction(async (db) => {
    const transaction = await updateTransaction(id, input, db);
    await syncTransactionReimbursement(transaction, db);
    await syncTransactionOwnerDebtPayable(transaction, db);
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
