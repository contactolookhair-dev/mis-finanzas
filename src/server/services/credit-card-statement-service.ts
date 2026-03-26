import { prisma } from "@/server/db/prisma";

export type CreditCardStatementSummary = {
  kind: string;
  accountId: string;
  fileName: string;
  periodStart: string | null;
  periodEnd: string | null;
  closingDate: string | null;
  paymentDate: string | null;
  totalBilled: number | null;
  minimumDue: number | null;
  creditLimit: number | null;
  creditUsed: number | null;
  creditAvailable: number | null;
  parserConfidence: number | null;
  missingFields: string[];
  warnings: string[];
  totals: {
    movementCount: number;
    dubiousCount: number;
    purchases: number;
    installmentPurchases: number;
    payments: number;
    refunds: number;
    fees: number;
    interests: number;
    cashAdvances: number;
    taxes: number;
    insurance: number;
    unknownCharges: number;
    unknownCredits: number;
  };
};

export type CreditCardStatementLatest = {
  batchId: string;
  createdAt: string;
  completedAt: string | null;
  summary: CreditCardStatementSummary;
};

function isStatementCandidate(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

export async function getLatestCreditCardStatement(input: {
  workspaceId: string;
  accountId: string;
}): Promise<CreditCardStatementLatest | null> {
  const batches = await prisma.importBatch.findMany({
    where: {
      workspaceId: input.workspaceId,
      status: "COMPLETED",
      parser: "PDF"
    },
    orderBy: [{ createdAt: "desc" }],
    take: 25,
    select: {
      id: true,
      createdAt: true,
      completedAt: true,
      fileName: true,
      metadata: true
    }
  });

  for (const batch of batches) {
    if (!isStatementCandidate(batch.metadata)) continue;
    const meta = batch.metadata as Record<string, unknown>;
    const statement = meta.creditCardStatement;
    if (!isStatementCandidate(statement)) continue;
    const s = statement as Record<string, unknown>;
    if (typeof s.accountId !== "string" || s.accountId !== input.accountId) continue;

    const summary: CreditCardStatementSummary = {
      kind: typeof s.kind === "string" ? s.kind : "unknown",
      accountId: s.accountId,
      fileName: typeof s.fileName === "string" ? s.fileName : batch.fileName,
      periodStart: typeof s.periodStart === "string" ? s.periodStart : null,
      periodEnd: typeof s.periodEnd === "string" ? s.periodEnd : null,
      closingDate: typeof s.closingDate === "string" ? s.closingDate : null,
      paymentDate: typeof s.paymentDate === "string" ? s.paymentDate : null,
      totalBilled: typeof s.totalBilled === "number" && Number.isFinite(s.totalBilled) ? s.totalBilled : null,
      minimumDue: typeof s.minimumDue === "number" && Number.isFinite(s.minimumDue) ? s.minimumDue : null,
      creditLimit: typeof s.creditLimit === "number" && Number.isFinite(s.creditLimit) ? s.creditLimit : null,
      creditUsed: typeof s.creditUsed === "number" && Number.isFinite(s.creditUsed) ? s.creditUsed : null,
      creditAvailable:
        typeof s.creditAvailable === "number" && Number.isFinite(s.creditAvailable) ? s.creditAvailable : null,
      parserConfidence:
        typeof s.parserConfidence === "number" && Number.isFinite(s.parserConfidence) ? s.parserConfidence : null,
      missingFields: Array.isArray(s.missingFields)
        ? (s.missingFields as unknown[]).filter((v): v is string => typeof v === "string")
        : [],
      warnings: Array.isArray(s.warnings)
        ? (s.warnings as unknown[]).filter((v): v is string => typeof v === "string")
        : [],
      totals: (() => {
        const totals = isStatementCandidate(s.totals) ? (s.totals as Record<string, unknown>) : {};
        const get = (key: string) =>
          typeof totals[key] === "number" && Number.isFinite(totals[key]) ? (totals[key] as number) : 0;
        return {
          movementCount: get("movementCount"),
          dubiousCount: get("dubiousCount"),
          purchases: get("purchases"),
          installmentPurchases: get("installmentPurchases"),
          payments: get("payments"),
          refunds: get("refunds"),
          fees: get("fees"),
          interests: get("interests"),
          cashAdvances: get("cashAdvances"),
          taxes: get("taxes"),
          insurance: get("insurance"),
          unknownCharges: get("unknownCharges"),
          unknownCredits: get("unknownCredits")
        };
      })()
    };

    return {
      batchId: batch.id,
      createdAt: batch.createdAt.toISOString(),
      completedAt: batch.completedAt ? batch.completedAt.toISOString() : null,
      summary
    };
  }

  return null;
}

