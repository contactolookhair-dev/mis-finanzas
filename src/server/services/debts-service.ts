import { DebtorStatus, ReimbursementStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { toAmountNumber } from "@/server/lib/amounts";

export type CompanyDebtItem = {
  id: string;
  name: string;
  reason: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: "PENDIENTE" | "ABONANDO" | "PAGADO";
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
  notes: string | null;
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
      status: "PENDIENTE" as const
    };

    const amount = Math.abs(toAmountNumber(item.amount));
    current.totalAmount += amount;
    if (item.status === ReimbursementStatus.REEMBOLSADO) {
      current.paidAmount += amount;
    }
    current.pendingAmount = Math.max(0, current.totalAmount - current.paidAmount);
    current.status =
      current.pendingAmount <= 0 ? "PAGADO" : current.paidAmount > 0 ? "ABONANDO" : "PENDIENTE";
    companiesMap.set(key, current);
  });

  const people = debtors.map<PersonDebtItem>((debtor) => {
    const paymentSum = debtor.payments.reduce((acc, payment) => acc + toAmountNumber(payment.amount), 0);
    const paidAmount = Math.max(toAmountNumber(debtor.paidAmount), paymentSum);
    const totalAmount = toAmountNumber(debtor.totalAmount);
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
      notes: debtor.notes ?? null
    };
  });

  const companies = [...companiesMap.values()].sort((a, b) => b.pendingAmount - a.pendingAmount);
  const pendingCompanies = companies.reduce((acc, item) => acc + item.pendingAmount, 0);
  const pendingPeople = people.reduce((acc, item) => acc + item.pendingAmount, 0);
  const collectedPeople = people.reduce((acc, item) => acc + item.paidAmount, 0);
  const collectedCompanies = companies.reduce((acc, item) => acc + item.paidAmount, 0);

  return {
    companies,
    people,
    totals: {
      pendingCompanies,
      pendingPeople,
      pendingTotal: pendingCompanies + pendingPeople,
      collectedTotal: collectedPeople + collectedCompanies
    }
  };
}

