import { formatCurrency } from "@/lib/formatters/currency";

export type CreditCardStatementSnapshot = {
  summary: {
    totalBilled: number | null;
    minimumPayment: number | null;
    creditLimit: number | null;
    usedLimit: number | null;
    availableLimit: number | null;
  };
  totals: {
    purchases: number;
    payments: number;
    interest: number;
    fees: number;
    cashAdvances: number;
    insurance: number;
    movementCount: number;
    dubiousCount: number;
  };
  warnings: string[];
  confidence: number | null;
};

export type CreditCardStatementInsightTone = "alert" | "attention" | "positive" | "info";

export type CreditCardStatementInsight = {
  tone: CreditCardStatementInsightTone;
  title: string;
  detail?: string;
};

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

function pctDelta(current: number | null, previous: number | null) {
  const d = delta(current, previous);
  if (d === null) return null;
  if (previous === null || previous === 0) return null;
  return d / previous;
}

export function generateCreditCardStatementInsights(args: {
  current: CreditCardStatementSnapshot;
  previous?: CreditCardStatementSnapshot | null;
  max?: number;
}) {
  const { current, previous } = args;
  const insights: CreditCardStatementInsight[] = [];

  const utilization = safeRatio(current.summary.usedLimit, current.summary.creditLimit);
  if (utilization !== null) {
    const pct = Math.round(utilization * 100);
    if (utilization >= 0.9) {
      insights.push({
        tone: "alert",
        title: "Cupo muy alto",
        detail: `Estás usando ${pct}% del cupo. Considera bajar consumo o adelantar un pago.`
      });
    } else if (utilization >= 0.7) {
      insights.push({
        tone: "attention",
        title: "Uso de cupo alto",
        detail: `Estás usando ${pct}% del cupo. Ojo con intereses y margen de maniobra.`
      });
    } else if (utilization <= 0.35) {
      insights.push({
        tone: "positive",
        title: "Uso de cupo controlado",
        detail: `Estás usando ${pct}% del cupo. Buena holgura.`
      });
    }
  }

  if (current.totals.interest > 0) {
    insights.push({
      tone: "attention",
      title: "Intereses detectados",
      detail: `Este período incluye ${formatCurrency(current.totals.interest)} en intereses.`
    });
  } else if (previous && previous.totals.interest > 0) {
    insights.push({
      tone: "positive",
      title: "Intereses en cero",
      detail: "Este período no registra intereses."
    });
  }

  if (current.totals.fees > 0) {
    insights.push({
      tone: "attention",
      title: "Comisiones detectadas",
      detail: `Este período incluye ${formatCurrency(current.totals.fees)} en comisiones.`
    });
  }

  if (current.totals.cashAdvances > 0) {
    insights.push({
      tone: "alert",
      title: "Avances detectados",
      detail: `Se registran ${formatCurrency(current.totals.cashAdvances)} en avances. Suelen tener costos altos.`
    });
  }

  if (current.totals.insurance > 0) {
    insights.push({
      tone: "info",
      title: "Seguro cargado",
      detail: `Este período incluye ${formatCurrency(current.totals.insurance)} en seguros.`
    });
  }

  if (previous) {
    const billedDelta = delta(current.summary.totalBilled, previous.summary.totalBilled);
    const billedPct = pctDelta(current.summary.totalBilled, previous.summary.totalBilled);
    if (billedDelta !== null && billedPct !== null && Math.abs(billedPct) >= 0.12) {
      insights.push({
        tone: billedDelta > 0 ? "attention" : "positive",
        title: billedDelta > 0 ? "Facturación subió" : "Facturación bajó",
        detail: `vs anterior ${billedDelta > 0 ? "+" : "−"}${formatCurrency(Math.abs(billedDelta))} (${Math.round(
          Math.abs(billedPct) * 100
        )}%).`
      });
    }

    const usedDelta = delta(current.summary.usedLimit, previous.summary.usedLimit);
    if (usedDelta !== null && Math.abs(usedDelta) >= 5000) {
      insights.push({
        tone: usedDelta > 0 ? "attention" : "positive",
        title: usedDelta > 0 ? "Cupo usado creció" : "Cupo usado bajó",
        detail: `vs anterior ${usedDelta > 0 ? "+" : "−"}${formatCurrency(Math.abs(usedDelta))}.`
      });
    }

    const minPayDelta = delta(current.summary.minimumPayment, previous.summary.minimumPayment);
    if (minPayDelta !== null && Math.abs(minPayDelta) >= 1000) {
      insights.push({
        tone: minPayDelta > 0 ? "attention" : "positive",
        title: minPayDelta > 0 ? "Pago mínimo subió" : "Pago mínimo bajó",
        detail: `vs anterior ${minPayDelta > 0 ? "+" : "−"}${formatCurrency(Math.abs(minPayDelta))}.`
      });
    }

    const interestDelta = current.totals.interest - previous.totals.interest;
    if (Math.abs(interestDelta) >= 1) {
      if (interestDelta < 0) {
        insights.push({
          tone: "positive",
          title: "Intereses bajaron",
          detail: `vs anterior −${formatCurrency(Math.abs(interestDelta))}.`
        });
      } else if (interestDelta > 0 && current.totals.interest > 0) {
        insights.push({
          tone: "attention",
          title: "Intereses subieron",
          detail: `vs anterior +${formatCurrency(Math.abs(interestDelta))}.`
        });
      }
    }

    const feesDelta = current.totals.fees - previous.totals.fees;
    if (Math.abs(feesDelta) >= 1) {
      if (feesDelta < 0) {
        insights.push({
          tone: "positive",
          title: "Comisiones bajaron",
          detail: `vs anterior −${formatCurrency(Math.abs(feesDelta))}.`
        });
      } else if (feesDelta > 0 && current.totals.fees > 0) {
        insights.push({
          tone: "attention",
          title: "Comisiones subieron",
          detail: `vs anterior +${formatCurrency(Math.abs(feesDelta))}.`
        });
      }
    }
  }

  if (current.summary.minimumPayment !== null && current.summary.minimumPayment > 0) {
    if (current.totals.payments > 0 && current.totals.payments < current.summary.minimumPayment) {
      insights.push({
        tone: "alert",
        title: "Abonos bajo el mínimo",
        detail: `Abonos ${formatCurrency(current.totals.payments)} vs mínimo ${formatCurrency(current.summary.minimumPayment)}.`
      });
    }
  }

  if ((current.confidence !== null && current.confidence < 0.7) || current.totals.dubiousCount > 0) {
    insights.push({
      tone: "info",
      title: "Revisión recomendada",
      detail:
        current.totals.dubiousCount > 0
          ? `${current.totals.dubiousCount} líneas dudosas en el PDF.`
          : "El parser detectó baja confianza en este período."
    });
  }

  // De-dup by title (keep first, which is usually the most actionable).
  const seen = new Set<string>();
  const unique = insights.filter((it) => {
    if (seen.has(it.title)) return false;
    seen.add(it.title);
    return true;
  });

  const order: Record<CreditCardStatementInsightTone, number> = {
    alert: 0,
    attention: 1,
    info: 2,
    positive: 3
  };
  unique.sort((a, b) => order[a.tone] - order[b.tone]);

  const max = args.max ?? 6;
  return unique.slice(0, max);
}

