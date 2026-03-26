import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireRoutePermission } from "@/server/permissions/route-permissions";

type BatchMetadataShape = Record<string, unknown>;

function asRecord(value: unknown): BatchMetadataShape | null {
  return value && typeof value === "object" ? (value as BatchMetadataShape) : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function GET(request: NextRequest) {
  const access = await requireRoutePermission(request, "transactions:import");
  if (!access.ok) return access.response;

  const takeParam = request.nextUrl.searchParams.get("take");
  const take = Math.min(Math.max(Number.parseInt(takeParam ?? "24", 10) || 24, 1), 60);

  const batches = await prisma.importBatch.findMany({
    where: { workspaceId: access.context.workspaceId },
    orderBy: [{ createdAt: "desc" }],
    take,
    select: {
      id: true,
      fileName: true,
      parser: true,
      status: true,
      rowsTotal: true,
      importedCount: true,
      duplicateCount: true,
      errorCount: true,
      createdAt: true,
      completedAt: true,
      metadata: true,
      transactions: {
        take: 1,
        orderBy: { createdAt: "asc" },
        select: {
          accountId: true,
          account: {
            select: {
              id: true,
              name: true,
              institution: true,
              type: true
            }
          }
        }
      }
    }
  });

  const items = batches.map((batch) => {
    const meta = asRecord(batch.metadata);
    const pdfMeta = asRecord(meta?.pdf);
    const creditStatement = asRecord(meta?.creditCardStatement);
    const statementWarnings = asStringArray(creditStatement?.warnings);
    const pdfWarnings = asStringArray(pdfMeta?.warnings);
    const missingFields = asStringArray(creditStatement?.missingFields);

    const accountFromMetadata =
      asString(creditStatement?.accountId) ??
      asString(pdfMeta?.primaryAccountId) ??
      batch.transactions[0]?.accountId ??
      null;

    const transactionAccount = batch.transactions[0]?.account ?? null;
    const importType = creditStatement ? "credit" : "account";
    const confidence = asNumber(creditStatement?.parserConfidence) ?? asNumber(asRecord(pdfMeta?.meta)?.parserConfidence);
    const dubiousCount = asNumber(asRecord(creditStatement?.totals)?.dubiousCount) ?? asNumber(asRecord(pdfMeta?.meta)?.dubiousMovements) ?? 0;
    const warningsCount = statementWarnings.length + pdfWarnings.length + missingFields.length;
    const detectedBank =
      asString(asRecord(pdfMeta?.meta)?.institution) ??
      asString(creditStatement?.kind) ??
      transactionAccount?.institution ??
      null;

    const visualState =
      batch.status === "FAILED"
        ? "error"
        : confidence !== null && confidence < 0.7
          ? "low_confidence"
          : warningsCount > 0 || dubiousCount > 0
            ? "warning"
            : "ok";

    return {
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
      importType,
      detectedBank,
      visualState,
      warningsCount,
      confidence,
      dubiousCount,
      account: accountFromMetadata
        ? {
            id: accountFromMetadata,
            name: transactionAccount?.name ?? null,
            institution: transactionAccount?.institution ?? null,
            type: transactionAccount?.type ?? null
          }
        : null,
      statement:
        creditStatement && importType === "credit"
          ? {
              periodLabel:
                [asString(creditStatement.periodStart), asString(creditStatement.periodEnd)]
                  .filter(Boolean)
                  .join(" -> ") || null,
              totalBilled: asNumber(creditStatement.totalBilled),
              minimumDue: asNumber(creditStatement.minimumDue),
              paymentDate: asString(creditStatement.paymentDate)
            }
          : null
    };
  });

  return NextResponse.json({ items });
}
