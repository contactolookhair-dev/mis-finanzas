import { DebtorStatus } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { toAmountNumber } from "@/server/lib/amounts";
import {
  computeNextInstallmentDate,
  inferPaidInstallmentsFromAmount
} from "@/server/services/debt-installments";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

const createPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paidAt: z.string().min(1),
  notes: z.string().optional().nullable()
});

function extractSourceTransactionIdFromNotes(notes: string | null | undefined) {
  if (!notes) return null;
  const match = notes.match(/\bauto:source-tx:([a-z0-9_]+)\b/i);
  return match ? match[1] : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { debtorId: string } }
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
    const input = createPaymentSchema.parse((await request.json()) as unknown);
    const debtor = await prisma.debtor.findFirst({
      where: {
        id: params.debtorId,
        workspaceId: context.workspaceId
      }
    });

    if (!debtor) {
      return NextResponse.json({ message: "Deuda no encontrada." }, { status: 404 });
    }

    const sourceTxId = extractSourceTransactionIdFromNotes(input.notes ?? null);
    if (sourceTxId) {
      const existing = await prisma.debtorPayment.findFirst({
        where: {
          debtorId: debtor.id,
          notes: {
            contains: `auto:source-tx:${sourceTxId}`
          }
        },
        select: { id: true }
      });
      if (existing) {
        return NextResponse.json({ ok: true, deduped: true });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.debtorPayment.create({
        data: {
          debtorId: debtor.id,
          amount: input.amount,
          paidAt: new Date(`${input.paidAt}T12:00:00`),
          notes: input.notes ?? null
        }
      });

      const nextPaidAmount = toAmountNumber(debtor.paidAmount) + input.amount;
      const totalAmount = toAmountNumber(debtor.totalAmount);
      const nextPaidInstallments = debtor.isInstallmentDebt
        ? Math.max(
            debtor.paidInstallments,
            inferPaidInstallmentsFromAmount(
              debtor.installmentValue,
              nextPaidAmount,
              debtor.installmentCount
            )
          )
        : debtor.paidInstallments;
      const nextInstallmentDate = debtor.isInstallmentDebt
        ? computeNextInstallmentDate(
            debtor.startDate,
            debtor.installmentFrequency,
            nextPaidInstallments,
            debtor.installmentCount
          )
        : debtor.nextInstallmentDate;
      const nextStatus =
        nextPaidAmount >= totalAmount
          ? DebtorStatus.PAGADO
          : nextPaidAmount > 0
            ? DebtorStatus.ABONANDO
            : DebtorStatus.PENDIENTE;

      await tx.debtor.update({
        where: { id: debtor.id },
        data: {
          paidAmount: nextPaidAmount,
          paidInstallments: nextPaidInstallments,
          nextInstallmentDate,
          status: nextStatus
        }
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Datos inválidos para registrar abono.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "No se pudo registrar el abono." }, { status: 500 });
  }
}
