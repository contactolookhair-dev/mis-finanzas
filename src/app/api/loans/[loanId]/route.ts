import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { LoanCounterpartyType, LoanInterestType, LoanStatus, LoanType } from "@prisma/client";
import { toAmountNumber } from "@/server/lib/amounts";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

const emptyToNull = (value: unknown) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD).");

const updateLoanSchema = z.object({
  counterpartyName: z.string().min(2).optional(),
  counterpartyType: z.enum(["person", "company", "custom"]).optional(),
  loanType: z.enum(["lent", "borrowed"]).optional(),
  amountTotal: z.coerce.number().positive().optional(),
  startDate: ymdSchema.optional(),
  dueDate: z.preprocess(emptyToNull, ymdSchema.optional().nullable()),
  description: z.preprocess(emptyToNull, z.string().optional().nullable()),
  businessUnitId: z.preprocess(emptyToNull, z.string().optional().nullable()),
  sourceAccountId: z.preprocess(emptyToNull, z.string().optional().nullable()),
  hasInterest: z.coerce.boolean().optional(),
  interestType: z.preprocess(
    emptyToNull,
    z.enum(["FIXED", "MONTHLY_PERCENT", "ANNUAL_PERCENT"]).optional().nullable()
  ),
  interestValue: z.coerce.number().optional().nullable()
});

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
}

function computeStatus(pending: number, dueDate: Date | null) {
  if (pending <= 0) return LoanStatus.PAID;
  if (dueDate && dueDate.getTime() < startOfToday().getTime()) return LoanStatus.OVERDUE;
  return LoanStatus.ACTIVE;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { loanId: string } }
) {
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
    const input = updateLoanSchema.parse((await request.json()) as unknown);
    const existing = await prisma.loan.findFirst({
      where: { id: params.loanId, workspaceId: context.workspaceId }
    });
    if (!existing) return NextResponse.json({ message: "Prestamo no encontrado." }, { status: 404 });

    const paid = toAmountNumber(existing.amountPaid);
    const nextTotal = typeof input.amountTotal === "number" ? Math.max(0, input.amountTotal) : toAmountNumber(existing.amountTotal);
    const nextPending = Math.max(0, nextTotal - paid);
    const dueDate = input.dueDate ? new Date(`${input.dueDate}T12:00:00`) : input.dueDate === null ? null : existing.dueDate;
    const status = computeStatus(nextPending, dueDate ?? null);

    await prisma.loan.update({
      where: { id: existing.id },
      data: {
        counterpartyName: input.counterpartyName ? input.counterpartyName.trim() : undefined,
        counterpartyType:
          input.counterpartyType === "person"
            ? LoanCounterpartyType.PERSON
            : input.counterpartyType === "company"
              ? LoanCounterpartyType.COMPANY
              : input.counterpartyType === "custom"
                ? LoanCounterpartyType.CUSTOM
                : undefined,
        loanType: input.loanType === "lent" ? LoanType.LENT : input.loanType === "borrowed" ? LoanType.BORROWED : undefined,
        businessUnitId: input.businessUnitId === undefined ? undefined : input.businessUnitId,
        sourceAccountId: input.sourceAccountId === undefined ? undefined : input.sourceAccountId,
        amountTotal: typeof input.amountTotal === "number" ? nextTotal : undefined,
        amountPending: typeof input.amountTotal === "number" ? nextPending : undefined,
        startDate: input.startDate ? new Date(`${input.startDate}T12:00:00`) : undefined,
        dueDate: input.dueDate ? new Date(`${input.dueDate}T12:00:00`) : input.dueDate === null ? null : undefined,
        status,
        description: input.description === undefined ? undefined : input.description,
        hasInterest: input.hasInterest === undefined ? undefined : Boolean(input.hasInterest),
        interestType:
          input.interestType === undefined
            ? undefined
            : ((input.interestType as LoanInterestType | null) ?? null),
        interestValue: input.interestValue === undefined ? undefined : input.interestValue
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Datos inválidos para editar préstamo.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "No se pudo editar el préstamo." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { loanId: string } }
) {
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
    const existing = await prisma.loan.findFirst({
      where: { id: params.loanId, workspaceId: context.workspaceId },
      select: { id: true }
    });
    if (!existing) return NextResponse.json({ message: "Prestamo no encontrado." }, { status: 404 });

    await prisma.loan.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "No se pudo eliminar el préstamo." }, { status: 500 });
  }
}
