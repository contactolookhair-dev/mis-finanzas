import { formatCurrency } from "@/lib/formatters/currency";

export type CreditAttentionTone = "alert" | "attention" | "positive" | "info";

export type CreditHealthLike = {
  utilizationPct: number | null;
  totals: {
    interest: number;
    fees: number;
    cashAdvances: number;
    dubiousCount: number;
  };
  deltas: {
    billed: number | null;
    used: number | null;
    interest: number | null;
    fees: number | null;
  };
  badges: Array<{ key: string; label: string; tone: CreditAttentionTone }>;
  priority: number;
};

export function creditToneToClasses(tone: CreditAttentionTone) {
  return tone === "alert"
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : tone === "attention"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : tone === "positive"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-slate-200 bg-slate-50 text-slate-700";
}

export function getCreditAttentionSeverity(item: CreditHealthLike) {
  const utilization = item.utilizationPct ?? 0;
  const hasAdv = item.totals.cashAdvances > 0;
  const hasInterest = item.totals.interest > 0;
  const hasFees = item.totals.fees > 0;
  const needsReview = item.badges.some((b) => b.key === "review");
  const debtUp = (item.deltas.used ?? 0) > 0;
  const improved = item.badges.some((b) => b.key === "improved");

  if (utilization >= 90 || hasAdv) return { level: "critical" as const, rank: 0 };
  if (hasInterest || hasFees || debtUp || utilization >= 70) return { level: "attention" as const, rank: 1 };
  if (needsReview) return { level: "info" as const, rank: 2 };
  if (improved) return { level: "positive" as const, rank: 3 };
  return { level: "neutral" as const, rank: 4 };
}

export function buildCreditAttentionContextLine(item: CreditHealthLike) {
  const utilization = item.utilizationPct;
  if (utilization !== null && utilization >= 90) return "Estás usando casi todo el cupo disponible.";
  if (item.totals.cashAdvances > 0) return "Ojo con avances: suelen ser de alto costo.";
  if (utilization !== null && utilization >= 70) return "Estás usando gran parte del cupo disponible.";
  if (item.totals.interest > 0) return "Este mes pagaste intereses en la tarjeta.";
  if (item.totals.fees > 0) return "Aparecieron comisiones en el estado de cuenta.";
  if (item.badges.some((b) => b.key === "review")) {
    return item.totals.dubiousCount > 0
      ? "La importación tiene movimientos dudosos."
      : "Conviene revisar la importación del estado.";
  }
  if (item.badges.some((b) => b.key === "improved")) {
    if ((item.deltas.used ?? 0) < 0) return "Bien ahí: bajó el cupo usado este mes.";
    if ((item.deltas.interest ?? 0) < 0) return "Bien ahí: bajaron los intereses este mes.";
    if ((item.deltas.fees ?? 0) < 0) return "Bien ahí: bajaron las comisiones este mes.";
    return "Mejoraste el uso de la tarjeta este mes.";
  }
  return "Tarjeta al día, sin señales fuertes este período.";
}

export function buildCreditAttentionBadges(item: CreditHealthLike) {
  const chips: Array<{ key: string; label: string; tone: CreditAttentionTone }> = [];

  if (item.utilizationPct !== null) {
    const tone: CreditAttentionTone =
      item.utilizationPct >= 90 ? "alert" : item.utilizationPct >= 70 ? "attention" : "info";
    chips.push({ key: "util", label: `Cupo ${item.utilizationPct}%`, tone });
  }

  if (item.totals.interest > 0) {
    chips.push({ key: "interest", label: `Intereses ${formatCurrency(item.totals.interest)}`, tone: "attention" });
  }

  if (item.totals.fees > 0) {
    chips.push({ key: "fees", label: `Comisiones ${formatCurrency(item.totals.fees)}`, tone: "info" });
  }

  if (item.totals.cashAdvances > 0) {
    chips.push({ key: "adv", label: `Avances ${formatCurrency(item.totals.cashAdvances)}`, tone: "alert" });
  }

  if (item.badges.some((b) => b.key === "review")) {
    chips.push({
      key: "review",
      label: item.totals.dubiousCount > 0 ? `Revisar (${item.totals.dubiousCount} dudosas)` : "Revisar importación",
      tone: "info"
    });
  }

  if ((item.deltas.used ?? 0) > 0) {
    chips.push({ key: "debtUp", label: `Deuda +${formatCurrency(item.deltas.used ?? 0)}`, tone: "attention" });
  }

  if (item.badges.some((b) => b.key === "improved")) {
    let improvedLabel = "Mejora reciente";
    if ((item.deltas.used ?? 0) < 0) improvedLabel = `Cupo usado ${formatCurrency(item.deltas.used ?? 0)}`;
    else if ((item.deltas.interest ?? 0) < 0) improvedLabel = `Intereses ${formatCurrency(item.deltas.interest ?? 0)}`;
    else if ((item.deltas.fees ?? 0) < 0) improvedLabel = `Comisiones ${formatCurrency(item.deltas.fees ?? 0)}`;
    chips.push({ key: "improved", label: improvedLabel, tone: "positive" });
  }

  return chips;
}

