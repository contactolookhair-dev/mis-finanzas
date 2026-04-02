import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

export const OWNER_DEBT_MARKER_PREFIX = "auto:owner-debt:tx:";

export function ownerDebtPayableMarker(transactionId: string) {
  return `${OWNER_DEBT_MARKER_PREFIX}${transactionId}`;
}

export function extractOwnerDebtMarkerFromNotes(notes: string | null | undefined) {
  if (!notes) return null;
  const match = notes.match(/\bauto:owner-debt:tx:[a-z0-9]+\b/i);
  return match ? match[0] : null;
}

export async function upsertOwnerDebtPayableForTransaction(
  input: {
    workspaceId: string;
    transactionId: string;
    origin: string;
    amount: number;
    dueDate: Date;
  },
  db: PrismaClient | Prisma.TransactionClient = prisma
) {
  const marker = ownerDebtPayableMarker(input.transactionId);
  const existing = await db.payable.findMany({
    where: {
      workspaceId: input.workspaceId,
      notes: {
        contains: marker
      }
    },
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true, notes: true }
  });

  const defaultNotes = `${marker} · Auto-generado desde transacción`;

  if (existing.length > 0) {
    const keep = existing[0]!;
    if (existing.length > 1) {
      const extras = existing.slice(1).map((p) => p.id);
      await db.payable.deleteMany({ where: { id: { in: extras } } });
    }

    return db.payable.update({
      where: { id: keep.id },
      data: {
        origin: input.origin.trim(),
        amount: new Prisma.Decimal(input.amount),
        dueDate: input.dueDate,
        // Preserve any user notes, but never allow removing the marker.
        notes: extractOwnerDebtMarkerFromNotes(keep.notes) ? (keep.notes ?? defaultNotes) : defaultNotes
      }
    });
  }

  return db.payable.create({
    data: {
      workspaceId: input.workspaceId,
      origin: input.origin.trim(),
      amount: new Prisma.Decimal(input.amount),
      dueDate: input.dueDate,
      notes: defaultNotes
    }
  });
}

export async function deleteOwnerDebtPayableForTransaction(
  workspaceId: string,
  transactionId: string,
  db: PrismaClient | Prisma.TransactionClient = prisma
) {
  const marker = ownerDebtPayableMarker(transactionId);
  await db.payable.deleteMany({
    where: {
      workspaceId,
      notes: {
        contains: marker
      }
    }
  });
}
