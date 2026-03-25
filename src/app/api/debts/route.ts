import { DebtorStatus, ExpenseFrequency } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { getDebtsSnapshot } from "@/server/services/debts-service";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

const createDebtorSchema = z.object({
  name: z.string().min(3),
  reason: z.string().min(3),
  totalAmount: z.coerce.number().positive(),
  startDate: z.string().min(1),
  estimatedPayDate: z.string().optional().nullable(),
  isInstallmentDebt: z.coerce.boolean().optional(),
  installmentCount: z.coerce.number().int().min(0).optional(),
  installmentValue: z.coerce.number().min(0).optional(),
  paidInstallments: z.coerce.number().int().min(0).optional(),
  installmentFrequency: z.nativeEnum(ExpenseFrequency).optional(),
  nextInstallmentDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId && DEV_MODE) {
    return NextResponse.json({
      companies: [],
      people: [],
      totals: {
        pendingCompanies: 0,
        pendingPeople: 0,
        pendingTotal: 0,
        collectedTotal: 0
      },
      commitments: {
        activeInstallmentDebts: 0,
        monthlyCommittedTotal: 0,
        upcomingCount: 0,
        overdueCount: 0,
        nextDueDate: null,
        nextDueDebtName: null,
        upcomingTimeline: []
      }
    });
  }
  if (!context.workspaceId || (!context.userKey && !DEV_MODE)) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    const snapshot = await getDebtsSnapshot(context.workspaceId);
    return NextResponse.json(snapshot);
  } catch {
    return NextResponse.json({ message: "No se pudieron cargar las deudas." }, { status: 500 });
  }
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

  try {
    const body = (await request.json()) as unknown;
    const input = createDebtorSchema.parse(body);
    const totalAmount = input.totalAmount;
    const requestedInstallmentCount = input.installmentCount ?? 0;
    const requestedInstallmentValue = input.installmentValue ?? 0;
    const isInstallmentDebt =
      input.isInstallmentDebt ?? (requestedInstallmentCount > 0 || requestedInstallmentValue > 0);
    const installmentCount = isInstallmentDebt ? requestedInstallmentCount : 0;
    const installmentValue = isInstallmentDebt ? requestedInstallmentValue : 0;
    const paidInstallments = isInstallmentDebt ? input.paidInstallments ?? 0 : 0;
    const paidAmount = isInstallmentDebt ? installmentValue * paidInstallments : 0;

    const created = await prisma.debtor.create({
      data: {
        workspaceId: context.workspaceId,
        name: input.name,
        reason: input.reason,
        totalAmount,
        paidAmount,
        startDate: new Date(`${input.startDate}T12:00:00`),
        estimatedPayDate: input.estimatedPayDate ? new Date(`${input.estimatedPayDate}T12:00:00`) : null,
        status: DebtorStatus.PENDIENTE,
        isInstallmentDebt,
        installmentCount,
        installmentValue,
        paidInstallments,
        installmentFrequency: isInstallmentDebt
          ? input.installmentFrequency ?? ExpenseFrequency.MENSUAL
          : ExpenseFrequency.MENSUAL,
        nextInstallmentDate: isInstallmentDebt && input.nextInstallmentDate
          ? new Date(`${input.nextInstallmentDate}T12:00:00`)
          : null,
        notes: input.notes ?? null
      }
    });

    return NextResponse.json({ id: created.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Datos inválidos para registrar deuda.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "No se pudo registrar la deuda." }, { status: 500 });
  }
}
