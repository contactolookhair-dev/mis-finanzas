import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { z } from "zod";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { BASE_TRANSACTION_MARKER } from "@/lib/constants/transactions";
import { updateTransactionWithAutomation } from "@/server/services/transaction-service";
import { buildDuplicateFingerprint } from "@/server/services/import/import-fingerprint";
import { toAmountNumber } from "@/server/lib/amounts";
import { deleteReimbursementByTransactionId } from "@/server/repositories/reimbursement-repository";
import { deleteOwnerDebtPayableForTransaction } from "@/server/repositories/payable-repository";

const patchSchema = z.object({
  date: z.string().min(1).optional(),
  description: z.string().min(3).optional(),
  amount: z.coerce.number().positive().optional(),
  type: z.enum(["INGRESO", "EGRESO"]).optional(),
  accountId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  creditImpactType: z
    .enum(["consume_cupo", "no_consume_cupo", "pago_tarjeta", "ajuste_manual"])
    .optional()
});

function toSignedAmount(input: { type: "INGRESO" | "EGRESO"; amount: number }) {
  return input.type === "EGRESO" ? -Math.abs(input.amount) : Math.abs(input.amount);
}

function toDateAtNoon(ymd: string) {
  return new Date(`${ymd}T12:00:00`);
}

function sourceTxMarker(transactionId: string) {
  return `auto:source-tx:${transactionId}`;
}

function removeMarkerFromNotes(input: string, marker: string) {
  const parts = input
    .split("·")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => p !== marker);
  return parts.length ? parts.join(" · ") : null;
}

function extractCreditCardInstallments(metadata: unknown) {
  const raw = metadata as any;
  const source = raw?.manual?.creditCardMeta ?? raw?.import?.creditCardMeta ?? null;
  if (!source) return null;

  const isInstallmentPurchase =
    source.esCompraEnCuotas === true ||
    source.isInstallmentPurchase === true ||
    (typeof source.cuotaTotal === "number" && source.cuotaTotal > 1) ||
    (typeof source.totalInstallments === "number" && source.totalInstallments > 1);
  if (!isInstallmentPurchase) return null;

  const cuotaActual =
    typeof source.cuotaActual === "number"
      ? source.cuotaActual
      : typeof source.currentInstallment === "number"
        ? source.currentInstallment
        : null;
  const cuotaTotal =
    typeof source.cuotaTotal === "number"
      ? source.cuotaTotal
      : typeof source.totalInstallments === "number"
        ? source.totalInstallments
        : null;
  const cuotasRestantes =
    typeof source.cuotasRestantes === "number"
      ? source.cuotasRestantes
      : typeof source.remainingInstallments === "number"
        ? source.remainingInstallments
        : typeof cuotaActual === "number" && typeof cuotaTotal === "number"
          ? Math.max(0, cuotaTotal - cuotaActual)
          : null;

  const installmentLabelRaw =
    typeof source.installmentLabelRaw === "string"
      ? source.installmentLabelRaw
      : typeof cuotaActual === "number" && typeof cuotaTotal === "number"
        ? `${cuotaActual}/${cuotaTotal}`
        : "en cuotas";

  return {
    isInstallmentPurchase: true,
    cuotaActual,
    cuotaTotal,
    cuotasRestantes,
    installmentLabelRaw
  };
}

export async function GET(_request: NextRequest, { params }: { params: { transactionId: string } }) {
  const context = await getWorkspaceContextFromRequest(_request);
  if (!context.workspaceId || !context.userKey) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  const tx = await prisma.transaction.findFirst({
    where: { id: params.transactionId, workspaceId: context.workspaceId },
    select: {
      id: true,
      date: true,
      description: true,
      amount: true,
      type: true,
      accountId: true,
      categoryId: true,
      businessUnitId: true,
      financialOrigin: true,
      isReimbursable: true,
      reviewStatus: true,
      notes: true,
      creditImpactType: true,
      metadata: true,
      account: { select: { name: true } },
      category: { select: { name: true } },
      businessUnit: { select: { name: true } }
    }
  });

  if (!tx) {
    return NextResponse.json({ message: "Movimiento no encontrado." }, { status: 404 });
  }

  const installments = extractCreditCardInstallments(tx.metadata);

  return NextResponse.json({
    item: {
      id: tx.id,
      date: tx.date.toISOString(),
      description: tx.description,
      amount: toAmountNumber(tx.amount),
      type: tx.type,
      accountId: tx.accountId ?? null,
      account: tx.account?.name ?? "Cuenta",
      categoryId: tx.categoryId ?? null,
      category: tx.category?.name ?? "Sin categoría",
      businessUnit: tx.businessUnit?.name ?? "",
      origin: tx.financialOrigin,
      reimbursable: Boolean(tx.isReimbursable),
      reviewStatus: tx.reviewStatus,
      notes: tx.notes ?? null,
      creditImpactType: tx.creditImpactType ?? "consume_cupo",
      ...(installments ?? {})
    }
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: { transactionId: string } }) {
  const context = await getWorkspaceContextFromRequest(_request);
  if (!context.workspaceId || !context.userKey) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: params.transactionId },
    select: { id: true, workspaceId: true, description: true }
  });

  if (!transaction || transaction.workspaceId !== context.workspaceId) {
    return NextResponse.json({ message: "Movimiento no encontrado." }, { status: 404 });
  }

  if (transaction.description === BASE_TRANSACTION_MARKER) {
    return NextResponse.json({ message: "No se puede eliminar un saldo base técnico." }, { status: 400 });
  }

  // Keep "Me deben" and "Debo pagar" consistent:
  // if a transaction was the source of any auto-generated items, delete them together.
  await prisma.$transaction(async (db) => {
    await deleteReimbursementByTransactionId(transaction.id, db);
    await deleteOwnerDebtPayableForTransaction(transaction.workspaceId, transaction.id, db);

    // IMPORTANT:
    // Person debts (Debtor) can aggregate multiple movements. Deleting one movement must NOT delete the whole debt,
    // otherwise users lose unrelated pending amounts (e.g. MacBook) when removing an old source transaction.
    // We only "unlink" the source marker from notes.
    const marker = sourceTxMarker(transaction.id);
    const linkedDebtors = await db.debtor.findMany({
      where: {
        workspaceId: transaction.workspaceId,
        notes: {
          contains: marker
        }
      },
      select: { id: true, notes: true }
    });

    for (const debtor of linkedDebtors) {
      const nextNotes = debtor.notes ? removeMarkerFromNotes(debtor.notes, marker) : null;
      await db.debtor.update({
        where: { id: debtor.id },
        data: { notes: nextNotes }
      });
    }

    await db.transaction.delete({ where: { id: transaction.id } });
  });
  return NextResponse.json({ deleted: transaction.id });
}

export async function PATCH(request: NextRequest, { params }: { params: { transactionId: string } }) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId || !context.userKey) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  const existing = await prisma.transaction.findFirst({
    where: { id: params.transactionId, workspaceId: context.workspaceId },
    select: {
      id: true,
      workspaceId: true,
      description: true,
      date: true,
      amount: true,
      type: true,
      accountId: true,
      categoryId: true,
      notes: true,
      creditImpactType: true
    }
  });

  if (!existing) {
    return NextResponse.json({ message: "Movimiento no encontrado." }, { status: 404 });
  }

  if (existing.description === BASE_TRANSACTION_MARKER) {
    return NextResponse.json({ message: "No se puede editar un saldo base técnico." }, { status: 400 });
  }

  try {
    const json = (await request.json()) as unknown;
    const input = patchSchema.parse(json);

    const nextType = input.type ?? existing.type;
    const nextDescription = (input.description ?? existing.description).trim();
    const nextDate = input.date ? toDateAtNoon(input.date) : existing.date;
    const nextAmountAbs =
      typeof input.amount === "number" && Number.isFinite(input.amount)
        ? input.amount
        : Math.abs(toAmountNumber(existing.amount));
    const nextSignedAmount = toSignedAmount({ type: nextType, amount: nextAmountAbs });

    const fingerprintChanged =
      Boolean(input.date) || Boolean(input.description) || typeof input.amount === "number" || Boolean(input.type);
    const duplicateFingerprint = fingerprintChanged
      ? buildDuplicateFingerprint({
          date: nextDate,
          amount: nextSignedAmount,
          description: nextDescription
        })
      : undefined;

    const updated = await updateTransactionWithAutomation(existing.id, {
      date: nextDate,
      description: nextDescription,
      amount: nextSignedAmount,
      type: nextType,
      accountId: input.accountId === undefined ? existing.accountId : input.accountId,
      categoryId: input.categoryId === undefined ? existing.categoryId : input.categoryId,
      notes: input.notes === undefined ? existing.notes : input.notes,
      creditImpactType: input.creditImpactType ?? existing.creditImpactType,
      ...(duplicateFingerprint ? { duplicateFingerprint } : {})
    });

    return NextResponse.json({
      item: {
        id: updated.id,
        date: updated.date.toISOString(),
        description: updated.description,
        amount: toAmountNumber(updated.amount),
        type: updated.type,
        accountId: updated.accountId,
        categoryId: updated.categoryId,
        notes: updated.notes ?? null,
        creditImpactType: updated.creditImpactType
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Datos invalidos para editar movimiento.", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "No se pudo editar el movimiento." }, { status: 500 });
  }
}
