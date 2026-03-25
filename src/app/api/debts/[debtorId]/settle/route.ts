import { DebtorStatus, ReimbursementStatus } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { toAmountNumber } from "@/server/lib/amounts";

const querySchema = z.object({
  kind: z.enum(["person", "company"])
});

export async function POST(
  request: NextRequest,
  { params }: { params: { debtorId: string } }
) {
  try {
    const context = await getWorkspaceContextFromRequest(request);
    if (!context.workspaceId) {
      return NextResponse.json(
        { message: "No se pudo resolver el workspace activo." },
        { status: 400 }
      );
    }

    const query = querySchema.parse({
      kind: request.nextUrl.searchParams.get("kind") ?? undefined
    });

    if (query.kind === "person") {
      const debtor = await prisma.debtor.findFirst({
        where: { id: params.debtorId, workspaceId: context.workspaceId }
      });

      if (!debtor) {
        return NextResponse.json({ message: "Deuda no encontrada." }, { status: 404 });
      }

      const pendingAmount = Math.max(
        0,
        toAmountNumber(debtor.totalAmount) - toAmountNumber(debtor.paidAmount)
      );

      await prisma.$transaction(async (tx) => {
        if (pendingAmount > 0) {
          await tx.debtorPayment.create({
            data: {
              debtorId: debtor.id,
              amount: pendingAmount,
              paidAt: new Date(),
              notes: "Cierre manual de deuda"
            }
          });
        }

        await tx.debtor.update({
          where: { id: debtor.id },
          data: {
            paidAmount: toAmountNumber(debtor.totalAmount),
            paidInstallments: debtor.isInstallmentDebt ? debtor.installmentCount : debtor.paidInstallments,
            nextInstallmentDate: debtor.isInstallmentDebt ? null : debtor.nextInstallmentDate,
            status: DebtorStatus.PAGADO
          }
        });
      });

      return NextResponse.json({ ok: true });
    }

    const updated = await prisma.reimbursement.updateMany({
      where: {
        workspaceId: context.workspaceId,
        businessUnitId: params.debtorId,
        status: ReimbursementStatus.PENDIENTE
      },
      data: {
        status: ReimbursementStatus.REEMBOLSADO,
        reimbursedAt: new Date()
      }
    });

    if (updated.count === 0) {
      return NextResponse.json({ message: "No hay reembolsos pendientes para cerrar." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, updated: updated.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "Parámetros inválidos para cerrar la deuda.",
          issues: error.issues
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: "No se pudo marcar la deuda como pagada."
      },
      { status: 500 }
    );
  }
}
