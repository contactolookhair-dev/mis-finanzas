import type { CreditCardStatementInsight, CreditCardStatementInsightTone, CreditCardStatementSnapshot } from "@/lib/accounts/credit-card-statement-insights";
import { formatCurrency } from "@/lib/formatters/currency";

export type CreditCardStatementActionTone = CreditCardStatementInsightTone;

export type CreditCardStatementAction = {
  tone: CreditCardStatementActionTone;
  title: string;
  detail?: string;
  // Optional deep-link hint for UI (kept data-only; UI decides how to render).
  href?: string;
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

export function generateCreditCardStatementActions(args: {
  current: CreditCardStatementSnapshot;
  previous?: CreditCardStatementSnapshot | null;
  insights?: CreditCardStatementInsight[];
  importBatchId?: string | null;
  max?: number;
}) {
  const { current, previous, insights, importBatchId } = args;
  const actions: CreditCardStatementAction[] = [];

  const utilization = safeRatio(current.summary.usedLimit, current.summary.creditLimit);
  if (utilization !== null) {
    const pct = Math.round(utilization * 100);
    if (utilization >= 0.9) {
      actions.push({
        tone: "alert",
        title: "Baja el uso del cupo",
        detail: `Estás en ${pct}% de uso. Evita nuevas compras y considera adelantar un pago.`
      });
    } else if (utilization >= 0.7) {
      actions.push({
        tone: "attention",
        title: "Recupera holgura de cupo",
        detail: `Vas en ${pct}% de uso. Un abono parcial puede mejorar tu cupo disponible.`
      });
    }
  }

  if (current.totals.interest > 0) {
    actions.push({
      tone: "attention",
      title: "Paga más que el mínimo",
      detail: `Tienes ${formatCurrency(current.totals.interest)} en intereses. Si puedes, paga sobre el mínimo para reducirlos.`
    });
  }

  if (current.totals.fees > 0) {
    actions.push({
      tone: "info",
      title: "Revisa comisiones",
      detail: `Hay ${formatCurrency(current.totals.fees)} en comisiones. Revisa si corresponde (mantención, compras, seguros).`
    });
  }

  if (current.totals.cashAdvances > 0) {
    actions.push({
      tone: "alert",
      title: "Evita avances en efectivo",
      detail: `Se detectan ${formatCurrency(current.totals.cashAdvances)} en avances. Suelen ser de alto costo.`
    });
  }

  if (current.summary.minimumPayment !== null && current.summary.minimumPayment > 0) {
    if (current.totals.payments > 0 && current.totals.payments < current.summary.minimumPayment) {
      actions.push({
        tone: "alert",
        title: "Completa el pago mínimo",
        detail: `Abonos ${formatCurrency(current.totals.payments)} vs mínimo ${formatCurrency(current.summary.minimumPayment)}.`
      });
    } else if (current.totals.payments === 0) {
      actions.push({
        tone: "attention",
        title: "Planifica el pago de este período",
        detail: current.summary.minimumPayment
          ? `Mínimo sugerido: ${formatCurrency(current.summary.minimumPayment)}.`
          : "Registra pagos para mantener la tarjeta al día."
      });
    }
  }

  if ((current.confidence !== null && current.confidence < 0.7) || current.totals.dubiousCount > 0) {
    actions.push({
      tone: "info",
      title: "Revisa el PDF importado",
      detail:
        current.totals.dubiousCount > 0
          ? `Hay ${current.totals.dubiousCount} líneas dudosas. Vale la pena revisarlas antes de tomar decisiones.`
          : "La confianza del parser es baja para este período; revisa el detalle del estado.",
      href: importBatchId ? `/importaciones?batchId=${encodeURIComponent(importBatchId)}` : "/importaciones"
    });
  }

  if (previous) {
    const billedDelta = delta(current.summary.totalBilled, previous.summary.totalBilled);
    if (billedDelta !== null && Math.abs(billedDelta) >= 10000) {
      actions.push({
        tone: billedDelta > 0 ? "attention" : "positive",
        title: billedDelta > 0 ? "Revisa qué subió tu facturación" : "Mantén el ritmo de gasto",
        detail: billedDelta > 0
          ? `Tu total facturado subió ${formatCurrency(Math.abs(billedDelta))} vs el período anterior.`
          : `Tu total facturado bajó ${formatCurrency(Math.abs(billedDelta))} vs el período anterior.`
      });
    }

    const usedDelta = delta(current.summary.usedLimit, previous.summary.usedLimit);
    if (usedDelta !== null && Math.abs(usedDelta) >= 10000) {
      actions.push({
        tone: usedDelta > 0 ? "attention" : "positive",
        title: usedDelta > 0 ? "Controla el cupo usado" : "Buen progreso bajando deuda",
        detail: usedDelta > 0
          ? `El cupo usado subió ${formatCurrency(Math.abs(usedDelta))} vs el período anterior.`
          : `El cupo usado bajó ${formatCurrency(Math.abs(usedDelta))} vs el período anterior.`
      });
    }
  }

  // If we already have strong alerts/attention in insights, avoid spamming similar actions.
  // Keep actions concise and de-duplicated by title.
  const insightTitles = new Set((insights ?? []).map((i) => i.title));
  const seen = new Set<string>();
  const unique = actions.filter((a) => {
    if (seen.has(a.title)) return false;
    // Avoid an action that simply repeats the same sentence as an insight title.
    if (insightTitles.has(a.title)) return false;
    seen.add(a.title);
    return true;
  });

  const order: Record<CreditCardStatementActionTone, number> = {
    alert: 0,
    attention: 1,
    info: 2,
    positive: 3
  };
  unique.sort((a, b) => order[a.tone] - order[b.tone]);

  const max = args.max ?? 6;
  return unique.slice(0, max);
}

