import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { listManualAccountsWithBalances } from "@/server/services/manual-accounts-service";

export const dynamic = "force-dynamic";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

type StatementSnapshot = {
  importBatchId: string;
  importedAt: string;
  summary: {
    periodLabel: string;
    totalBilled: number | null;
    minimumPayment: number | null;
    creditLimit: number | null;
    usedLimit: number | null;
    availableLimit: number | null;
  };
  totals: {
    interest: number;
    fees: number;
    cashAdvances: number;
    dubiousCount: number;
  };
  confidence: number | null;
};

function isObj(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function parseStatementFromBatch(batch: {
  id: string;
  createdAt: Date;
  metadata: unknown;
}) {
  if (!isObj(batch.metadata)) return null;
  const statement = (batch.metadata as Record<string, unknown>).creditCardStatement;
  if (!isObj(statement)) return null;
  const s = statement as Record<string, unknown>;
  const accountId = typeof s.accountId === "string" ? s.accountId : null;
  if (!accountId) return null;

  // Keep this endpoint aligned with /api/accounts/[id]/statements response.
  const periodStart = typeof s.periodStart === "string" ? s.periodStart : null;
  const periodEnd = typeof s.periodEnd === "string" ? s.periodEnd : null;
  const closingDate = typeof s.closingDate === "string" ? s.closingDate : null;
  const periodLabel =
    periodStart && periodEnd ? `${periodStart} → ${periodEnd}` : closingDate ? `Cierre ${closingDate}` : "Período";

  const totals = isObj(s.totals) ? (s.totals as Record<string, unknown>) : {};
  const getNum = (key: string) =>
    typeof totals[key] === "number" && Number.isFinite(totals[key]) ? (totals[key] as number) : 0;

  const snapshot: StatementSnapshot = {
    importBatchId: batch.id,
    importedAt: batch.createdAt.toISOString(),
    summary: {
      periodLabel,
      totalBilled: typeof s.totalBilled === "number" && Number.isFinite(s.totalBilled) ? (s.totalBilled as number) : null,
      minimumPayment:
        typeof s.minimumDue === "number" && Number.isFinite(s.minimumDue) ? (s.minimumDue as number) : null,
      creditLimit:
        typeof s.creditLimit === "number" && Number.isFinite(s.creditLimit) ? (s.creditLimit as number) : null,
      usedLimit: typeof s.creditUsed === "number" && Number.isFinite(s.creditUsed) ? (s.creditUsed as number) : null,
      availableLimit:
        typeof s.creditAvailable === "number" && Number.isFinite(s.creditAvailable) ? (s.creditAvailable as number) : null
    },
    totals: {
      interest: getNum("interests"),
      fees: getNum("fees"),
      cashAdvances: getNum("cashAdvances"),
      dubiousCount: getNum("dubiousCount")
    },
    confidence:
      typeof s.parserConfidence === "number" && Number.isFinite(s.parserConfidence) ? (s.parserConfidence as number) : null
  };

  return { accountId, snapshot };
}

function safeRatio(n: number | null, d: number | null) {
  if (n === null || d === null) return null;
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return n / d;
}

function delta(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return current - previous;
}

export async function GET(request: NextRequest) {
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

  const accounts = await listManualAccountsWithBalances(context.workspaceId);
  const creditAccounts = accounts.filter((a) => a.type === "CREDITO");
  if (creditAccounts.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const creditAccountIds = new Set(creditAccounts.map((a) => a.id));
  const needed = new Map<string, { latest?: StatementSnapshot; previous?: StatementSnapshot }>();
  for (const id of creditAccountIds) needed.set(id, {});

  const batches = await prisma.importBatch.findMany({
    where: {
      workspaceId: context.workspaceId,
      status: "COMPLETED",
      parser: "PDF"
    },
    orderBy: [{ createdAt: "desc" }],
    take: 250,
    select: {
      id: true,
      createdAt: true,
      metadata: true
    }
  });

  for (const batch of batches) {
    const parsed = parseStatementFromBatch(batch);
    if (!parsed) continue;
    if (!creditAccountIds.has(parsed.accountId)) continue;
    const entry = needed.get(parsed.accountId)!;
    if (!entry.latest) {
      entry.latest = parsed.snapshot;
    } else if (!entry.previous) {
      entry.previous = parsed.snapshot;
    }

    let done = true;
    for (const v of needed.values()) {
      if (!v.latest) {
        done = false;
        break;
      }
    }
    if (done) {
      // If all have latest, we can keep scanning for previous only while it's cheap;
      // but we stop once all also have previous (best effort).
      let donePrev = true;
      for (const v of needed.values()) {
        if (!v.previous) {
          donePrev = false;
          break;
        }
      }
      if (donePrev) break;
    }
  }

  const items = creditAccounts
    .map((account) => {
      const statements = needed.get(account.id) ?? {};
      const latest = statements.latest;
      if (!latest) return null;
      const previous = statements.previous ?? null;

      const utilization = safeRatio(latest.summary.usedLimit, latest.summary.creditLimit);
      const utilizationPct = utilization === null ? null : Math.round(utilization * 100);

      const hasInterest = latest.totals.interest > 0;
      const hasFees = latest.totals.fees > 0;
      const hasCashAdvances = latest.totals.cashAdvances > 0;
      const needsReview = (latest.confidence !== null && latest.confidence < 0.7) || latest.totals.dubiousCount > 0;

      const billedDelta = previous ? delta(latest.summary.totalBilled, previous.summary.totalBilled) : null;
      const usedDelta = previous ? delta(latest.summary.usedLimit, previous.summary.usedLimit) : null;
      const interestDelta = previous ? latest.totals.interest - previous.totals.interest : null;
      const feesDelta = previous ? latest.totals.fees - previous.totals.fees : null;

      const improved =
        (usedDelta !== null && usedDelta < 0) ||
        (interestDelta !== null && interestDelta < 0) ||
        (feesDelta !== null && feesDelta < 0);

      const badges: Array<{ key: string; label: string; tone: "alert" | "attention" | "positive" | "info" }> = [];
      if (utilization !== null && utilization >= 0.9) badges.push({ key: "very-high", label: "Cupo muy alto", tone: "alert" });
      else if (utilization !== null && utilization >= 0.7) badges.push({ key: "high", label: "Cupo alto", tone: "attention" });
      if (hasInterest) badges.push({ key: "interest", label: "Con intereses", tone: "attention" });
      if (hasFees) badges.push({ key: "fees", label: "Con comisiones", tone: "info" });
      if (hasCashAdvances) badges.push({ key: "adv", label: "Con avances", tone: "alert" });
      if (needsReview) badges.push({ key: "review", label: "Revisar importación", tone: "info" });
      if (improved) badges.push({ key: "improved", label: "Mejora reciente", tone: "positive" });

      const priority =
        (utilization !== null && utilization >= 0.9 ? 100 : utilization !== null && utilization >= 0.7 ? 70 : 0) +
        (hasCashAdvances ? 65 : 0) +
        (hasInterest ? 55 : 0) +
        (hasFees ? 35 : 0) +
        (needsReview ? 30 : 0) +
        (billedDelta !== null && billedDelta > 0 ? 10 : 0);

      return {
        accountId: account.id,
        name: account.name,
        bank: account.bank ?? null,
        importedAt: latest.importedAt,
        importBatchId: latest.importBatchId,
        periodLabel: latest.summary.periodLabel,
        utilizationPct,
        totals: latest.totals,
        deltas: {
          billed: billedDelta,
          used: usedDelta,
          interest: interestDelta,
          fees: feesDelta
        },
        badges,
        priority
      };
    })
    .filter((v): v is NonNullable<typeof v> => Boolean(v))
    .sort((a, b) => b.priority - a.priority);

  return NextResponse.json({ items });
}
