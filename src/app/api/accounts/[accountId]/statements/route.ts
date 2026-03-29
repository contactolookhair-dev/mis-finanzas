import { NextResponse, type NextRequest } from "next/server";
import { getWorkspaceContextFromRequest } from "@/server/tenant/workspace-context";
import { listCreditCardStatements } from "@/server/services/credit-card-statement-service";

const DEV_MODE = process.env.ENABLE_DEV_AUTH_LOGIN === "true";

function detectBankLabel(kind: string) {
  if (kind === "falabella-cmr") return "Banco Falabella / CMR";
  return "Estado de cuenta";
}

export async function GET(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
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

  const items = await listCreditCardStatements({
    workspaceId: context.workspaceId,
    accountId: params.accountId,
    take: 50
  });

  const responseItems = items.map((item) => {
    const summary = item.summary;
    const periodLabel =
      summary.periodStart && summary.periodEnd
        ? `${summary.periodStart} → ${summary.periodEnd}`
        : summary.closingDate
          ? `Cierre ${summary.closingDate}`
          : "Período";

    return {
      importBatchId: item.batchId,
      importedAt: item.createdAt,
      detectedBank: detectBankLabel(summary.kind),
      statementKind: summary.kind,
      summary: {
        periodLabel,
        closingDate: summary.closingDate,
        dueDate: summary.paymentDate,
        totalBilled: summary.totalBilled,
        minimumPayment: summary.minimumDue,
        creditLimit: summary.creditLimit,
        usedLimit: summary.creditUsed,
        availableLimit: summary.creditAvailable
      },
      totals: {
        // Keep legacy aggregated fields for backwards-compatibility.
        purchases: summary.totals.purchases + summary.totals.installmentPurchases,
        payments: summary.totals.payments + summary.totals.refunds,
        // New, more explicit breakdown for credit-card UX.
        purchasesNormal: summary.totals.purchases,
        purchasesInstallments: summary.totals.installmentPurchases,
        paymentsOnly: summary.totals.payments,
        refunds: summary.totals.refunds,
        interest: summary.totals.interests,
        fees: summary.totals.fees,
        cashAdvances: summary.totals.cashAdvances,
        insurance: summary.totals.insurance,
        movementCount: summary.totals.movementCount,
        dubiousCount: summary.totals.dubiousCount
      },
      warnings: summary.warnings,
      confidence: summary.parserConfidence
    };
  });

  return NextResponse.json({ items: responseItems });
}
