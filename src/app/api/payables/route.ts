import { NextResponse, type NextRequest } from "next/server";
import { AccountType, FinancialOrigin } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import {
  OWNER_DEBT_MARKER_PREFIX,
  extractOwnerDebtMarkerFromNotes,
  upsertOwnerDebtPayableForTransaction
} from "@/server/repositories/payable-repository";
import { toAmountNumber } from "@/server/lib/amounts";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

const upsertPayableSchema = z.object({
  origin: z.string().min(2),
  amount: z.coerce.number().positive(),
  dueDate: z.string().min(1),
  paidAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

function extractTransactionIdFromOwnerDebtMarker(marker: string | null) {
  if (!marker) return null;
  if (!marker.startsWith(OWNER_DEBT_MARKER_PREFIX)) return null;
  const id = marker.slice(OWNER_DEBT_MARKER_PREFIX.length).trim();
  return id.length ? id : null;
}

function extractSourceTransactionIdFromDebtorNotes(notes: string | null) {
  if (!notes) return null;
  const match = notes.match(/auto:source-tx:([a-z0-9]+)/i);
  return match?.[1] ?? null;
}

function isOwedFromTransactionMetadata(metadata: unknown) {
  const raw = metadata as any;
  return raw?.manual?.owed?.isOwed === true || raw?.import?.owed?.isOwed === true;
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
  const installmentsRemaining =
    typeof source.cuotasRestantes === "number"
      ? source.cuotasRestantes
      : typeof source.remainingInstallments === "number"
        ? source.remainingInstallments
        : typeof installmentCurrent === "number" && typeof installmentTotal === "number"
          ? Math.max(0, installmentTotal - installmentCurrent)
          : null;

  const installmentAmount =
    typeof source.installmentAmount === "number" && Number.isFinite(source.installmentAmount)
      ? source.installmentAmount
      : typeof source.montoCuota === "number" && Number.isFinite(source.montoCuota)
        ? source.montoCuota
        : null;

  const purchaseTotalAmount =
    typeof source.totalPurchaseAmount === "number" && Number.isFinite(source.totalPurchaseAmount)
      ? source.totalPurchaseAmount
      : typeof source.montoTotalCompra === "number" && Number.isFinite(source.montoTotalCompra)
        ? source.montoTotalCompra
        : null;

  return {
    isInstallmentPurchase: true,
    installmentCurrent,
    installmentTotal,
    installmentsRemaining,
    installmentAmount,
    purchaseTotalAmount
  };
}

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId && DEV_MODE) {
    return NextResponse.json({ items: [] });
  }
  if (!context.workspaceId || (!context.userKey && !DEV_MODE)) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  try {
    // If a debtor exists and references a source transaction, that spend is reimbursable and must not
    // be auto-generated into "Debo pagar" payables (even if older transactions missed isReimbursable=true).
    const debtorNotes = await prisma.debtor.findMany({
      where: {
        workspaceId: context.workspaceId,
        notes: {
          contains: "auto:source-tx:"
        }
      },
      select: {
        notes: true
      }
    });
    const debtorSourceTxIds = [
      ...new Set(
        debtorNotes
          .map((item) => extractSourceTransactionIdFromDebtorNotes(item.notes ?? null))
          .filter((value): value is string => Boolean(value))
      )
    ];

    // Self-heal: ensure "owner debts" created from credit-card purchases exist as payables.
    // This is intentionally limited and idempotent via the marker in notes.
	    const recentOwnerDebtTransactions = await prisma.transaction.findMany({
	      where: {
	        workspaceId: context.workspaceId,
	        type: "EGRESO",
	        financialOrigin: FinancialOrigin.PERSONAL,
	        isReimbursable: false,
	        isBusinessPaidPersonally: false,
	        ...(debtorSourceTxIds.length > 0 ? { id: { notIn: debtorSourceTxIds } } : {}),
	        account: {
	          is: {
	            type: AccountType.TARJETA_CREDITO
	          }
	        }
	      },
	      orderBy: [{ date: "desc" }],
	      take: 200,
	      select: {
	        id: true,
	        date: true,
	        description: true,
	        amount: true,
	        metadata: true,
	        account: {
	          select: {
	            name: true
	          }
	        }
	      }
	    });

	    for (const tx of recentOwnerDebtTransactions) {
	      // If someone owes this spend (stored in tx metadata), it must never show in "Debo pagar".
	      if (isOwedFromTransactionMetadata(tx.metadata)) continue;
	      const amount = Math.max(0, Math.abs(toAmountNumber(tx.amount)));
	      if (!Number.isFinite(amount) || amount <= 0) continue;
	      await upsertOwnerDebtPayableForTransaction(
	        {
          workspaceId: context.workspaceId,
          transactionId: tx.id,
          origin: `${tx.account?.name ?? "Tarjeta"} · ${tx.description}`,
          amount,
          dueDate: new Date(tx.date)
        },
        prisma
      );
    }

    // Cleanup: if older bugs created duplicates for auto-generated owner-debt payables,
    // keep only one per (card + dueDate + amount). Never touch manual payables.
    const autoPayables = await prisma.payable.findMany({
      where: {
        workspaceId: context.workspaceId,
        paidAt: null,
        notes: {
          contains: OWNER_DEBT_MARKER_PREFIX
        }
      },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        origin: true,
        amount: true,
        dueDate: true,
        updatedAt: true
      }
    });

    const normalizeCard = (origin: string) => origin.split("·")[0]?.trim().toLowerCase() ?? "tarjeta";
    const seen = new Set<string>();
    const dupIds: string[] = [];

    for (const item of autoPayables) {
      const card = normalizeCard(item.origin);
      const amount = Number(item.amount);
      const due = item.dueDate.toISOString().slice(0, 10);
      const key = `${card}|${due}|${amount}`;
      if (seen.has(key)) {
        dupIds.push(item.id);
      } else {
        seen.add(key);
      }
    }

    if (dupIds.length > 0) {
      await prisma.payable.deleteMany({
        where: {
          workspaceId: context.workspaceId,
          id: { in: dupIds }
        }
      });
    }

    const items = await prisma.payable.findMany({
      where: { workspaceId: context.workspaceId },
      orderBy: [{ paidAt: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }]
    });

    const ownerDebtTxIds = [...new Set(
      items
        .map((item) => extractTransactionIdFromOwnerDebtMarker(extractOwnerDebtMarkerFromNotes(item.notes)))
        .filter((value): value is string => Boolean(value))
    )];

	    const ownerDebtTxById = new Map<
	      string,
	      { id: string; metadata: unknown; amount: number; isReimbursable: boolean; isOwed: boolean }
	    >();
	    if (ownerDebtTxIds.length > 0) {
	      const txs = await prisma.transaction.findMany({
	        where: {
	          workspaceId: context.workspaceId,
          id: { in: ownerDebtTxIds }
        },
        select: {
          id: true,
          metadata: true,
          amount: true,
          isReimbursable: true
	        }
	      });
	      for (const tx of txs) {
	        const isOwed = isOwedFromTransactionMetadata(tx.metadata);
	        ownerDebtTxById.set(tx.id, {
	          id: tx.id,
	          metadata: tx.metadata,
	          amount: Math.abs(toAmountNumber(tx.amount)),
	          isReimbursable: Boolean(tx.isReimbursable) || isOwed,
	          isOwed
	        });
	      }
	    }

    // If older bugs created "owner debt" payables for transactions that are actually reimbursable
    // (someone else owes the spend), remove them so they don't show in "Debo pagar".
    // This is safe because these payables are auto-generated (marker in notes).
    const reimbursableOwnerDebtPayableIds = items
      .map((item) => {
        const txId = extractTransactionIdFromOwnerDebtMarker(
          extractOwnerDebtMarkerFromNotes(item.notes)
        );
        if (!txId) return null;
        if (debtorSourceTxIds.includes(txId)) return item.id;
        const tx = ownerDebtTxById.get(txId);
        if (!tx?.isReimbursable) return null;
        return item.id;
      })
      .filter((value): value is string => Boolean(value));

    if (reimbursableOwnerDebtPayableIds.length > 0) {
      await prisma.payable.deleteMany({
        where: {
          workspaceId: context.workspaceId,
          id: { in: reimbursableOwnerDebtPayableIds },
          notes: {
            contains: OWNER_DEBT_MARKER_PREFIX
          }
        }
      });
    }

    return NextResponse.json({
      items: items
        .filter((item) => !reimbursableOwnerDebtPayableIds.includes(item.id))
        .map((item) => ({
        ...(() => {
          const txId = extractTransactionIdFromOwnerDebtMarker(extractOwnerDebtMarkerFromNotes(item.notes));
          const tx = txId ? ownerDebtTxById.get(txId) ?? null : null;
          const fromMeta = tx ? extractCreditCardInstallments(tx.metadata) : null;
          if (!fromMeta) return {};

          // Source of truth for totals:
          // - Prefer explicit "total compra" from metadata when present.
          // - Otherwise, fall back to the underlying transaction amount (most often the total purchase for manual entries).
          // IMPORTANT: never compute total as (installmentAmount * installmentTotal) because installmentAmount may be the total.
          const purchaseTotalAmount =
            typeof fromMeta.purchaseTotalAmount === "number" && Number.isFinite(fromMeta.purchaseTotalAmount)
              ? fromMeta.purchaseTotalAmount
              : typeof tx?.amount === "number" && Number.isFinite(tx.amount)
                ? tx.amount
                : null;

          // Installment amount to pay now:
          // - Prefer explicit installmentAmount when it looks like a per-installment value.
          // - Otherwise derive as round(total / totalInstallments).
          const metaInstallmentAmount =
            typeof fromMeta.installmentAmount === "number" && Number.isFinite(fromMeta.installmentAmount)
              ? fromMeta.installmentAmount
              : null;

          const installmentTotal =
            typeof fromMeta.installmentTotal === "number" && Number.isFinite(fromMeta.installmentTotal)
              ? fromMeta.installmentTotal
              : null;

          const derivedInstallmentAmount =
            typeof purchaseTotalAmount === "number" &&
            Number.isFinite(purchaseTotalAmount) &&
            typeof installmentTotal === "number" &&
            Number.isFinite(installmentTotal) &&
            installmentTotal > 0
              ? Math.round(purchaseTotalAmount / installmentTotal)
              : null;

          const looksLikePerInstallment =
            typeof purchaseTotalAmount === "number" &&
            Number.isFinite(purchaseTotalAmount) &&
            typeof installmentTotal === "number" &&
            Number.isFinite(installmentTotal) &&
            installmentTotal > 1 &&
            typeof metaInstallmentAmount === "number" &&
            Number.isFinite(metaInstallmentAmount)
              ? metaInstallmentAmount > 0 && metaInstallmentAmount < purchaseTotalAmount
              : false;

          const installmentAmount = looksLikePerInstallment ? metaInstallmentAmount : derivedInstallmentAmount;

          return {
            isInstallmentPurchase: true,
            installmentCurrent: fromMeta.installmentCurrent ?? null,
            installmentTotal: fromMeta.installmentTotal ?? null,
            installmentsRemaining: fromMeta.installmentsRemaining ?? null,
            installmentAmount: typeof installmentAmount === "number" && Number.isFinite(installmentAmount) ? installmentAmount : null,
            purchaseTotalAmount:
              typeof purchaseTotalAmount === "number" && Number.isFinite(purchaseTotalAmount) ? purchaseTotalAmount : null
          };
        })(),
        id: item.id,
        origin: item.origin,
        amount: Number(item.amount),
        dueDate: item.dueDate.toISOString(),
        paidAt: item.paidAt?.toISOString() ?? null,
        notes: item.notes ?? null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
      }))
    });
  } catch {
    return NextResponse.json({ message: "No se pudieron cargar los pagos pendientes." }, { status: 500 });
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
    const input = upsertPayableSchema.parse((await request.json()) as unknown);
    const created = await prisma.payable.create({
      data: {
        workspaceId: context.workspaceId,
        origin: input.origin.trim(),
        amount: input.amount,
        dueDate: new Date(`${input.dueDate}T12:00:00`),
        paidAt: input.paidAt ? new Date(`${input.paidAt}T12:00:00`) : null,
        notes: input.notes ?? null
      }
    });
    return NextResponse.json({ id: created.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Datos inválidos para registrar pendiente.", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "No se pudo registrar el pendiente." }, { status: 500 });
  }
}
