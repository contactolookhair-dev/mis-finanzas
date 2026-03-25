import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { BASE_TRANSACTION_MARKER } from "@/lib/constants/transactions";

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

  await prisma.transaction.delete({ where: { id: transaction.id } });
  return NextResponse.json({ deleted: transaction.id });
}
