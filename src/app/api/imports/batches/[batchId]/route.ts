import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireRoutePermission } from "@/server/permissions/route-permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const access = await requireRoutePermission(request, "transactions:import");
  if (!access.ok) return access.response;

  const { batchId } = await params;
  if (!batchId || typeof batchId !== "string") {
    return NextResponse.json({ message: "batchId inválido." }, { status: 400 });
  }

  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, workspaceId: access.context.workspaceId }
  });

  if (!batch) {
    return NextResponse.json({ message: "Importación no encontrada." }, { status: 404 });
  }

  return NextResponse.json({
    id: batch.id,
    fileName: batch.fileName,
    parser: batch.parser,
    status: batch.status,
    rowsTotal: batch.rowsTotal,
    importedCount: batch.importedCount,
    duplicateCount: batch.duplicateCount,
    errorCount: batch.errorCount,
    createdAt: batch.createdAt.toISOString(),
    completedAt: batch.completedAt ? batch.completedAt.toISOString() : null,
    metadata: batch.metadata ?? null
  });
}

