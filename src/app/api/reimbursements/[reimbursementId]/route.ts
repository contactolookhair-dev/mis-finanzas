import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";

// Only used to clean up orphan auto-generated reimbursements left behind by older bugs.
// If a reimbursement still has a source transaction, deleting it here would break sync semantics,
// so we require transactionId = null.
export async function DELETE(request: NextRequest, { params }: { params: { reimbursementId: string } }) {
  const context = await getWorkspaceContextFromRequest(request);
  if (!context.workspaceId || !context.userKey) {
    return NextResponse.json({ message: "Sesion requerida." }, { status: 401 });
  }

  const item = await prisma.reimbursement.findFirst({
    where: { id: params.reimbursementId, workspaceId: context.workspaceId },
    select: { id: true, transactionId: true, notes: true }
  });

  if (!item) {
    return NextResponse.json({ message: "Registro no encontrado." }, { status: 404 });
  }

  if (item.transactionId) {
    return NextResponse.json(
      { message: "Este registro está asociado a un movimiento. Elimina el movimiento para sincronizar." },
      { status: 400 }
    );
  }

  await prisma.reimbursement.delete({ where: { id: item.id } });
  return NextResponse.json({ deleted: item.id });
}

