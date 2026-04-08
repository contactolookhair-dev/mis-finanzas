import { DebtorStatus, ExpenseFrequency, ReimbursementStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { toAmountNumber } from "@/server/lib/amounts";
import { buildDebtInstallmentPlan } from "@/server/services/debt-installments";
import {
  buildDebtCommitmentsSummary,
  deriveInstallmentHealth
} from "@/server/services/debt-commitments-service";

export type CompanyDebtItem = {
  id: string;
  name: string;
  reason: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: "PENDIENTE" | "ABONANDO" | "PAGADO";
  entries: Array<{
    id: string;
    transactionId: string | null;
    amount: number;
    status: string;
    reimbursedAt: string | null;
    notes: string | null;
    createdAt: string;
  }>;
};

export type PersonDebtItem = {
  id: string;
  name: string;
  reason: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: DebtorStatus;
  startDate: string;
  estimatedPayDate: string | null;
  isInstallmentDebt: boolean;
  installmentCount: number;
  installmentValue: number;
  paidInstallments: number;
  installmentFrequency: ExpenseFrequency;
  nextInstallmentDate: string | null;
  installmentsPending: number;
  installmentProgress: number;
  installmentRemainingAmount: number;
  installmentStatus: "AL_DIA" | "PROXIMA" | "VENCIDA" | "PAGADA";
  installmentStatusLabel: string;
  installmentDaysUntilDue: number | null;
  notes: string | null;
  // Optional enrichment when this debt originated from a credit-card transaction with installments.
  creditInstallmentAmount?: number | null;
  creditPurchaseTotalAmount?: number | null;
  creditInstallmentCurrent?: number | null;
  creditInstallmentTotal?: number | null;
  creditInstallmentsRemaining?: number | null;
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    notes: string | null;
  }>;
};

function extractSourceTransactionIdFromNotes(notes: string | null | undefined) {
  if (!notes) return null;
  const match = notes.match(/\bauto:source-tx:([a-z0-9_]+)\b/i);
  return match ? match[1] : null;
}

function extractCreditCardInstallments(metadata: unknown) {
  const raw = metadata as any;
  const source = raw?.manual?.creditCardMeta ?? raw?.import?.creditCardMeta ?? null;
  if (!source) return null;

  const installmentCurrent =
    typeof source.cuotaActual === "number"
      ? source.cuotaActual
      : typeof source.currentInstallment === "number"
        ? source.currentInstallment
        : null;
  const installmentTotal =
    typeof source.cuotaTotal === "number"
      ? source.cuotaTotal
      : typeof source.totalInstallments === "number"
        ? source.totalInstallments
        : null;
  const hasInstallments =
    (typeof installmentTotal === "number" && Number.isFinite(installmentTotal) && installmentTotal > 1) ||
    source.esCompraEnCuotas === true ||
    source.isInstallmentPurchase === true;
  if (!hasInstallments) return null;

  const purchaseTotalAmount =
    typeof source.totalPurchaseAmount === "number" && Number.isFinite(source.totalPurchaseAmount)
      ? source.totalPurchaseAmount
      : typeof source.montoTotalCompra === "number" && Number.isFinite(source.montoTotalCompra)
        ? source.montoTotalCompra
        : null;

  const rawInstallmentAmount =
    typeof source.installmentAmount === "number" && Number.isFinite(source.installmentAmount)
      ? source.installmentAmount
      : typeof source.montoCuota === "number" && Number.isFinite(source.montoCuota)
        ? source.montoCuota
        : null;

  return {
    installmentCurrent,
    installmentTotal,
    purchaseTotalAmount,
    rawInstallmentAmount
  };
}

export async function getDebtsSnapshot(workspaceId: string) {
  const [reimbursements, debtors] = await Promise.all([
    prisma.reimbursement.findMany({
      where: { workspaceId },
      include: { businessUnit: true, transaction: { select: { id: true, metadata: true, amount: true } } }
    }),
    prisma.debtor.findMany({
      where: { workspaceId },
      include: {
        payments: true
      },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  const companiesMap = new Map<string, CompanyDebtItem>();

  reimbursements.forEach((item) => {
    const key = item.businessUnitId;
    const current = companiesMap.get(key) ?? {
      id: key,
      name: item.businessUnit.name,
      reason: "Gastos empresariales pagados con fondos personales",
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      status: "PENDIENTE" as const,
      entries: []
    };

    const amount = Math.abs(toAmountNumber(item.amount));
    current.totalAmount += amount;
    if (item.status === ReimbursementStatus.REEMBOLSADO) {
      current.paidAmount += amount;
    }
    current.entries.push({
      id: item.id,
      transactionId: item.transactionId ?? null,
      amount,
      status: item.status,
      reimbursedAt: item.reimbursedAt?.toISOString() ?? null,
      notes: item.notes ?? null,
      createdAt: item.createdAt.toISOString()
    });
    current.pendingAmount = Math.max(0, current.totalAmount - current.paidAmount);
    current.status =
      current.pendingAmount <= 0 ? "PAGADO" : current.paidAmount > 0 ? "ABONANDO" : "PENDIENTE";
    companiesMap.set(key, current);
  });

  // For "Me deben" debts originating from a credit-card transaction, enrich with installment metadata.
  // This is best-effort and does not mutate DB.
  const debtorSourceTxIds = [...new Set(debtors.map((d) => extractSourceTransactionIdFromNotes(d.notes)).filter(Boolean))] as string[];
  const recentTransactions = await prisma.transaction.findMany({
    where: { workspaceId, type: "EGRESO" },
    orderBy: [{ date: "desc" }],
    take: 800,
    select: { id: true, description: true, date: true, amount: true, metadata: true }
  });

  const txById = new Map(recentTransactions.map((tx) => [tx.id, tx]));

  const normalizeText = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim();

  const txByAbsAmount = new Map<number, typeof recentTransactions>();
  for (const tx of recentTransactions) {
    const abs = Math.abs(toAmountNumber(tx.amount));
    if (!Number.isFinite(abs) || abs <= 0) continue;
    const key = Math.round(abs);
    const existing = txByAbsAmount.get(key);
    if (existing) {
      existing.push(tx);
    } else {
      txByAbsAmount.set(key, [tx]);
    }
  }

  const approxEqual = (a: number, b: number, tolerancePct = 0.02) => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    if (a === b) return true;
    const denom = Math.max(1, Math.abs(b));
    return Math.abs(a - b) / denom <= tolerancePct;
  };

  // Self-heal: older bugs could store credit-card installment debts as:
  // - totalAmount = purchaseTotal * installmentTotal (double counted)
  // - installmentValue = purchaseTotal (instead of per-installment)
  // If the debt has a strong source transaction marker, we can safely correct it.
  const debtorFixes: Array<{
    id: string;
    nextTotalAmount: number;
    nextInstallmentCount: number;
    nextInstallmentValue: number;
    nextPaidInstallments: number;
    nextPaidAmount: number;
    nextStatus: DebtorStatus;
  }> = [];

  const paymentsSumByDebtorId = new Map<string, number>();
  for (const debtor of debtors) {
    const sum = (debtor.payments ?? []).reduce((acc, p) => acc + toAmountNumber(p.amount), 0);
    paymentsSumByDebtorId.set(debtor.id, sum);
  }

  for (const debtor of debtors) {
    const sourceTxId = extractSourceTransactionIdFromNotes(debtor.notes);
    if (!sourceTxId) continue;
    const tx = txById.get(sourceTxId);
    if (!tx) continue;
    const meta = extractCreditCardInstallments(tx.metadata);
    if (!meta) continue;

    const installmentTotal =
      typeof meta.installmentTotal === "number" && Number.isFinite(meta.installmentTotal) ? meta.installmentTotal : null;
    const purchaseTotal =
      typeof meta.purchaseTotalAmount === "number" && Number.isFinite(meta.purchaseTotalAmount)
        ? meta.purchaseTotalAmount
        : null;
    if (!installmentTotal || installmentTotal <= 1 || !purchaseTotal || purchaseTotal <= 0) continue;

    const rawInstallment =
      typeof meta.rawInstallmentAmount === "number" && Number.isFinite(meta.rawInstallmentAmount)
        ? meta.rawInstallmentAmount
        : null;
    const perInstallment = rawInstallment && rawInstallment > 0 && rawInstallment < purchaseTotal
      ? rawInstallment
      : Math.round(purchaseTotal / installmentTotal);
    if (!Number.isFinite(perInstallment) || perInstallment <= 0) continue;

    const storedTotal = toAmountNumber(debtor.totalAmount);
    const storedInstallmentValue = toAmountNumber(debtor.installmentValue);

    const looksDoubleCounted =
      approxEqual(storedTotal, purchaseTotal * installmentTotal, 0.02) ||
      approxEqual(storedInstallmentValue, purchaseTotal, 0.02);
    if (!looksDoubleCounted) continue;

    const nextTotalAmount = Math.max(1, Math.round(purchaseTotal));
    const nextInstallmentCount = Math.max(2, Math.round(installmentTotal));
    const nextInstallmentValue = Math.max(1, Math.round(perInstallment));
    const nextPaidInstallments = Math.min(nextInstallmentCount, Math.max(0, debtor.paidInstallments ?? 0));

    const paymentsSum = paymentsSumByDebtorId.get(debtor.id) ?? 0;
    const paidFromInstallments = nextInstallmentValue * nextPaidInstallments;
    const nextPaidAmount = Math.min(nextTotalAmount, Math.max(paymentsSum, paidFromInstallments, 0));

    const nextStatus =
      nextPaidAmount >= nextTotalAmount
        ? DebtorStatus.PAGADO
        : nextPaidAmount > 0
          ? DebtorStatus.ABONANDO
          : DebtorStatus.PENDIENTE;

    debtorFixes.push({
      id: debtor.id,
      nextTotalAmount,
      nextInstallmentCount,
      nextInstallmentValue,
      nextPaidInstallments,
      nextPaidAmount,
      nextStatus
    });
  }

  if (debtorFixes.length) {
    await prisma.$transaction(
      debtorFixes.map((fix) =>
        prisma.debtor.update({
          where: { id: fix.id },
          data: {
            totalAmount: fix.nextTotalAmount,
            isInstallmentDebt: true,
            installmentCount: fix.nextInstallmentCount,
            installmentValue: fix.nextInstallmentValue,
            paidInstallments: fix.nextPaidInstallments,
            paidAmount: fix.nextPaidAmount,
            status: fix.nextStatus
          }
        })
      )
    );

    const fixesById = new Map(debtorFixes.map((f) => [f.id, f]));
    for (const debtor of debtors) {
      const fix = fixesById.get(debtor.id);
      if (!fix) continue;
      (debtor as any).totalAmount = fix.nextTotalAmount;
      (debtor as any).isInstallmentDebt = true;
      (debtor as any).installmentCount = fix.nextInstallmentCount;
      (debtor as any).installmentValue = fix.nextInstallmentValue;
      (debtor as any).paidInstallments = fix.nextPaidInstallments;
      (debtor as any).paidAmount = fix.nextPaidAmount;
      (debtor as any).status = fix.nextStatus;
    }
  }

  const people = debtors.map<PersonDebtItem>((debtor) => {
    const paymentSum = debtor.payments.reduce((acc, payment) => acc + toAmountNumber(payment.amount), 0);
    const paidAmount = Math.max(toAmountNumber(debtor.paidAmount), paymentSum);
    const totalAmount = toAmountNumber(debtor.totalAmount);
    const installmentPlan = buildDebtInstallmentPlan({
      isInstallmentDebt: debtor.isInstallmentDebt,
      installmentCount: debtor.installmentCount,
      installmentValue: debtor.installmentValue,
      paidInstallments: debtor.paidInstallments,
      installmentFrequency: debtor.installmentFrequency,
      startDate: debtor.startDate,
      nextInstallmentDate: debtor.nextInstallmentDate,
      totalAmount: debtor.totalAmount,
      paidAmount
    });
    const installmentHealth = deriveInstallmentHealth({
      pendingInstallments: installmentPlan.pendingInstallments,
      pendingAmount: Math.max(0, totalAmount - paidAmount),
      nextInstallmentDate: installmentPlan.nextInstallmentDate,
      status: debtor.status
    });

    const sourceTxId = extractSourceTransactionIdFromNotes(debtor.notes);
    const directTx = sourceTxId ? txById.get(sourceTxId) ?? null : null;
    const normalizedReason = normalizeText(debtor.reason);
    const amountKey = Math.round(Math.abs(totalAmount));
    const candidates = txByAbsAmount.get(amountKey) ?? [];
    const bestCandidate =
      directTx ??
      candidates.find((tx) => {
        const normalizedDesc = normalizeText(tx.description);
        return normalizedDesc.includes(normalizedReason) || normalizedReason.includes(normalizedDesc);
      }) ??
      candidates.find((tx) => Boolean(extractCreditCardInstallments(tx.metadata))) ??
      (candidates[0] ?? null);

    const txMeta = bestCandidate ? extractCreditCardInstallments(bestCandidate.metadata) : null;
    const txAbsAmount = bestCandidate ? Math.abs(toAmountNumber(bestCandidate.amount)) : null;
    const purchaseTotalAmount =
      txMeta?.purchaseTotalAmount != null
        ? txMeta.purchaseTotalAmount
        : typeof txAbsAmount === "number" && Number.isFinite(txAbsAmount)
          ? txAbsAmount
          : null;
    const installmentTotal =
      typeof txMeta?.installmentTotal === "number" && Number.isFinite(txMeta.installmentTotal)
        ? txMeta.installmentTotal
        : null;
    const installmentCurrent =
      typeof txMeta?.installmentCurrent === "number" && Number.isFinite(txMeta.installmentCurrent)
        ? txMeta.installmentCurrent
        : null;
    const rawInstallmentAmount =
      typeof txMeta?.rawInstallmentAmount === "number" && Number.isFinite(txMeta.rawInstallmentAmount)
        ? txMeta.rawInstallmentAmount
        : null;
    const looksLikePerInstallment =
      typeof purchaseTotalAmount === "number" &&
      Number.isFinite(purchaseTotalAmount) &&
      typeof installmentTotal === "number" &&
      Number.isFinite(installmentTotal) &&
      installmentTotal > 1 &&
      typeof rawInstallmentAmount === "number" &&
      Number.isFinite(rawInstallmentAmount)
        ? rawInstallmentAmount > 0 && rawInstallmentAmount < purchaseTotalAmount
        : false;
    const creditInstallmentAmount =
      looksLikePerInstallment
        ? rawInstallmentAmount
        : typeof purchaseTotalAmount === "number" &&
            Number.isFinite(purchaseTotalAmount) &&
            typeof installmentTotal === "number" &&
            Number.isFinite(installmentTotal) &&
            installmentTotal > 0
          ? Math.round(purchaseTotalAmount / installmentTotal)
          : null;
    const creditInstallmentsRemaining =
      typeof installmentCurrent === "number" && typeof installmentTotal === "number"
        ? Math.max(0, installmentTotal - installmentCurrent)
        : null;

    return {
      id: debtor.id,
      name: debtor.name,
      reason: debtor.reason,
      totalAmount,
      paidAmount,
      pendingAmount: Math.max(0, totalAmount - paidAmount),
      status: debtor.status,
      startDate: debtor.startDate.toISOString(),
      estimatedPayDate: debtor.estimatedPayDate?.toISOString() ?? null,
      isInstallmentDebt: installmentPlan.enabled,
      installmentCount: installmentPlan.totalInstallments,
      installmentValue: installmentPlan.installmentValue,
      paidInstallments: installmentPlan.paidInstallments,
      installmentFrequency: installmentPlan.frequency,
      nextInstallmentDate: installmentPlan.nextInstallmentDate,
      installmentsPending: installmentPlan.pendingInstallments,
      installmentProgress: installmentPlan.progressPercent,
      installmentRemainingAmount: installmentPlan.remainingAmount,
      installmentStatus: installmentHealth.health,
      installmentStatusLabel: installmentHealth.label,
      installmentDaysUntilDue: installmentHealth.daysUntilDue,
      notes: debtor.notes ?? null,
      ...(installmentTotal && installmentTotal > 1
        ? {
            creditInstallmentAmount,
            creditPurchaseTotalAmount: purchaseTotalAmount,
            creditInstallmentCurrent: installmentCurrent,
            creditInstallmentTotal: installmentTotal,
            creditInstallmentsRemaining
          }
        : {}),
      payments: debtor.payments
        .slice()
        .sort((left, right) => right.paidAt.getTime() - left.paidAt.getTime())
        .map((payment) => ({
          id: payment.id,
          amount: toAmountNumber(payment.amount),
          paidAt: payment.paidAt.toISOString(),
          notes: payment.notes ?? null
        }))
    };
  });

  const companies = [...companiesMap.values()].sort((a, b) => b.pendingAmount - a.pendingAmount);
  const pendingCompanies = companies.reduce((acc, item) => acc + item.pendingAmount, 0);
  const pendingPeople = people.reduce((acc, item) => acc + item.pendingAmount, 0);
  const collectedPeople = people.reduce((acc, item) => acc + item.paidAmount, 0);
  const collectedCompanies = companies.reduce((acc, item) => acc + item.paidAmount, 0);
  const commitments = buildDebtCommitmentsSummary(
    people.map((item) => ({
      id: item.id,
      name: item.name,
      reason: item.reason,
      installmentValue: item.installmentValue,
      pendingAmount: item.pendingAmount,
      pendingInstallments: item.installmentsPending,
      nextInstallmentDate: item.nextInstallmentDate,
      installmentFrequency: item.installmentFrequency,
      status: item.status
    }))
  );

  return {
    companies,
    people,
    totals: {
      pendingCompanies,
      pendingPeople,
      pendingTotal: pendingCompanies + pendingPeople,
      collectedTotal: collectedPeople + collectedCompanies
    },
    commitments
  };
}
