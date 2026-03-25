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
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    notes: string | null;
  }>;
};

export async function getDebtsSnapshot(workspaceId: string) {
  const [reimbursements, debtors] = await Promise.all([
    prisma.reimbursement.findMany({
      where: { workspaceId },
      include: { businessUnit: true }
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
