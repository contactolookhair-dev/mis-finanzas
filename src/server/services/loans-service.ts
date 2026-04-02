import { DebtorStatus, LoanCounterpartyType, LoanInterestType, LoanStatus, LoanType } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { toAmountNumber } from "@/server/lib/amounts";

const LOAN_MARKER_PREFIX = "auto:loan:";

function loanMarker(loanId: string) {
  return `${LOAN_MARKER_PREFIX}${loanId}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
}

function computeStatus(pending: number, dueDate: Date | null) {
  if (pending <= 0) return LoanStatus.PAID;
  if (dueDate && dueDate.getTime() < startOfToday().getTime()) return LoanStatus.OVERDUE;
  return LoanStatus.ACTIVE;
}

async function ensureDerivedForLoan(loan: {
  id: string;
  workspaceId: string;
  loanType: LoanType;
  counterpartyName: string;
  amountTotal: any;
  amountPaid: any;
  amountPending: any;
  startDate: Date;
  dueDate: Date | null;
  description: string | null;
}) {
  const marker = loanMarker(loan.id);
  const total = Math.max(0, toAmountNumber(loan.amountTotal));
  const paid = Math.max(0, toAmountNumber(loan.amountPaid));
  const pending = Math.max(0, toAmountNumber(loan.amountPending));

  if (loan.loanType === LoanType.LENT) {
    const existing = await prisma.debtor.findFirst({
      where: { workspaceId: loan.workspaceId, notes: { contains: marker } },
      select: { id: true }
    });

    if (!existing) {
      await prisma.debtor.create({
        data: {
          workspaceId: loan.workspaceId,
          name: loan.counterpartyName,
          reason: loan.description ?? "Prestamo",
          totalAmount: total,
          paidAmount: paid,
          startDate: loan.startDate,
          estimatedPayDate: loan.dueDate,
          status: pending <= 0 ? DebtorStatus.PAGADO : DebtorStatus.PENDIENTE,
          isInstallmentDebt: false,
          installmentCount: 0,
          installmentValue: 0,
          paidInstallments: 0,
          installmentFrequency: "MENSUAL",
          nextInstallmentDate: null,
          notes: marker
        }
      });
    } else {
      await prisma.debtor.update({
        where: { id: existing.id },
        data: {
          name: loan.counterpartyName,
          reason: loan.description ?? "Prestamo",
          totalAmount: total,
          paidAmount: paid,
          estimatedPayDate: loan.dueDate,
          status: pending <= 0 ? DebtorStatus.PAGADO : paid > 0 ? DebtorStatus.ABONANDO : DebtorStatus.PENDIENTE,
          notes: marker
        }
      });
    }

    return;
  }

  const existing = await prisma.payable.findFirst({
    where: { workspaceId: loan.workspaceId, notes: { contains: marker } },
    select: { id: true }
  });

  const origin = `${loan.counterpartyName} · Prestamo`;
  const dueDate = loan.dueDate ?? loan.startDate;
  if (!existing) {
    await prisma.payable.create({
      data: {
        workspaceId: loan.workspaceId,
        origin,
        amount: pending > 0 ? pending : total,
        dueDate,
        paidAt: pending <= 0 ? new Date() : null,
        notes: marker
      }
    });
  } else {
    await prisma.payable.update({
      where: { id: existing.id },
      data: {
        origin,
        amount: pending > 0 ? pending : total,
        dueDate,
        paidAt: pending <= 0 ? new Date() : null,
        notes: marker
      }
    });
  }
}

export async function listLoans(workspaceId: string, loanType?: LoanType) {
  const loans = await prisma.loan.findMany({
    where: { workspaceId, loanType: loanType ?? undefined },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      payments: {
        orderBy: { paidAt: "desc" }
      }
    }
  });

  return loans.map((loan) => ({
    id: loan.id,
    loanType: loan.loanType === LoanType.LENT ? "lent" : "borrowed",
    counterpartyType:
      loan.counterpartyType === LoanCounterpartyType.PERSON
        ? "person"
        : loan.counterpartyType === LoanCounterpartyType.COMPANY
          ? "company"
          : "custom",
    counterpartyName: loan.counterpartyName,
    amountTotal: toAmountNumber(loan.amountTotal),
    amountPaid: toAmountNumber(loan.amountPaid),
    amountPending: toAmountNumber(loan.amountPending),
    startDate: loan.startDate.toISOString(),
    dueDate: loan.dueDate?.toISOString() ?? null,
    status: loan.status === LoanStatus.PAID ? "paid" : loan.status === LoanStatus.OVERDUE ? "overdue" : "active",
    description: loan.description ?? null,
    hasInterest: loan.hasInterest,
    interestType: loan.interestType ?? null,
    interestValue: loan.interestValue ? toAmountNumber(loan.interestValue) : null,
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
    payments: loan.payments.map((p) => ({
      id: p.id,
      amount: toAmountNumber(p.amount),
      paidAt: p.paidAt.toISOString(),
      notes: p.notes ?? null
    }))
  }));
}

export async function createLoan(input: {
  workspaceId: string;
  loanType: LoanType;
  counterpartyType: LoanCounterpartyType;
  counterpartyName: string;
  businessUnitId?: string | null;
  sourceAccountId?: string | null;
  amountTotal: number;
  startDate: Date;
  dueDate?: Date | null;
  description?: string | null;
  hasInterest?: boolean;
  interestType?: LoanInterestType | null;
  interestValue?: number | null;
}) {
  const total = Math.max(0, input.amountTotal);
  const pending = total;
  const status = computeStatus(pending, input.dueDate ?? null);

  const loan = await prisma.loan.create({
    data: {
      workspaceId: input.workspaceId,
      loanType: input.loanType,
      counterpartyType: input.counterpartyType,
      counterpartyName: input.counterpartyName.trim(),
      businessUnitId: input.businessUnitId ?? null,
      sourceAccountId: input.sourceAccountId ?? null,
      amountTotal: total,
      amountPaid: 0,
      amountPending: pending,
      startDate: input.startDate,
      dueDate: input.dueDate ?? null,
      status,
      description: input.description ?? null,
      hasInterest: Boolean(input.hasInterest),
      interestType: input.interestType ?? null,
      interestValue: input.interestValue ?? null
    }
  });

  await ensureDerivedForLoan({
    id: loan.id,
    workspaceId: loan.workspaceId,
    loanType: loan.loanType,
    counterpartyName: loan.counterpartyName,
    amountTotal: loan.amountTotal,
    amountPaid: loan.amountPaid,
    amountPending: loan.amountPending,
    startDate: loan.startDate,
    dueDate: loan.dueDate,
    description: loan.description
  });

  return loan;
}

export async function addLoanPayment(input: {
  workspaceId: string;
  loanId: string;
  amount: number;
  paidAt: Date;
  notes?: string | null;
}) {
  const loan = await prisma.loan.findFirst({
    where: { id: input.loanId, workspaceId: input.workspaceId },
    select: {
      id: true,
      workspaceId: true,
      loanType: true,
      counterpartyName: true,
      amountTotal: true,
      amountPaid: true,
      amountPending: true,
      startDate: true,
      dueDate: true,
      description: true
    }
  });
  if (!loan) throw new Error("Loan not found");

  const paymentAmount = Math.max(0, input.amount);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) throw new Error("Invalid amount");

  const marker = loanMarker(loan.id);

  await prisma.$transaction(async (tx) => {
    await tx.loanPayment.create({
      data: {
        loanId: loan.id,
        amount: paymentAmount,
        paidAt: input.paidAt,
        notes: input.notes ? input.notes.trim() : null
      }
    });

    const nextPaid = Math.max(0, toAmountNumber(loan.amountPaid) + paymentAmount);
    const total = Math.max(0, toAmountNumber(loan.amountTotal));
    const nextPending = Math.max(0, total - nextPaid);
    const nextStatus = computeStatus(nextPending, loan.dueDate);

    await tx.loan.update({
      where: { id: loan.id },
      data: {
        amountPaid: nextPaid,
        amountPending: nextPending,
        status: nextStatus
      }
    });

    // Keep derived entities in sync.
    if (loan.loanType === LoanType.LENT) {
      const debtor = await tx.debtor.findFirst({
        where: { workspaceId: loan.workspaceId, notes: { contains: marker } },
        select: { id: true, totalAmount: true, paidAmount: true }
      });
      if (debtor) {
        await tx.debtorPayment.create({
          data: {
            debtorId: debtor.id,
            amount: paymentAmount,
            paidAt: input.paidAt,
            notes: "Abono de prestamo"
          }
        });
        await tx.debtor.update({
          where: { id: debtor.id },
          data: {
            paidAmount: nextPaid,
            status: nextPending <= 0 ? DebtorStatus.PAGADO : nextPaid > 0 ? DebtorStatus.ABONANDO : DebtorStatus.PENDIENTE
          }
        });
      }
    } else {
      const payable = await tx.payable.findFirst({
        where: { workspaceId: loan.workspaceId, notes: { contains: marker } },
        select: { id: true }
      });
      if (payable) {
        await tx.payable.update({
          where: { id: payable.id },
          data: {
            amount: nextPending > 0 ? nextPending : total,
            paidAt: nextPending <= 0 ? input.paidAt : null
          }
        });
      }
    }
  });

  // Ensure derived exists even if it was deleted.
  await ensureDerivedForLoan({
    ...loan,
    amountPaid: toAmountNumber(loan.amountPaid) + paymentAmount,
    amountPending: Math.max(0, toAmountNumber(loan.amountTotal) - (toAmountNumber(loan.amountPaid) + paymentAmount))
  });
}
