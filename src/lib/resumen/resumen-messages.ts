import type { DashboardSnapshot } from "@/shared/types/dashboard";

type CreditHealthItem = {
  utilizationPct: number | null;
  badges: Array<{ key: string; label: string; tone: "alert" | "attention" | "positive" | "info" }>;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function pickResumenMensajes(input: {
  dashboard: DashboardSnapshot;
  creditHealth?: CreditHealthItem[] | null;
}) {
  const { dashboard, creditHealth } = input;
  const msgs: string[] = [];

  const expenses = Math.abs(dashboard.kpis.expenses);
  const incomes = Math.abs(dashboard.kpis.incomes);
  const net = dashboard.kpis.netFlow;
  const expDeltaPct = dashboard.comparisons.expenses.deltaPct;

  if (net < 0 && incomes > 0) {
    msgs.push("Ojo: este mes estai en rojo. Si podís, baja un poco los gastos para volver a equilibrar.");
  }

  if (expDeltaPct >= 0.18) {
    msgs.push("Ojo, este mes estás gastando harto más que el mes pasado.");
  } else if (expDeltaPct <= -0.12) {
    msgs.push("Bien ahí: bajaste tus gastos vs el mes pasado. Sigue así.");
  }

  const topCategory = dashboard.charts.categories?.[0] ?? null;
  if (topCategory && expenses > 0) {
    const share = topCategory.value / expenses;
    if (share >= 0.32) {
      const name = topCategory.name;
      const n = normalizeText(name);
      if (n.includes("comida") || n.includes("super") || n.includes("rest") || n.includes("delivery")) {
        msgs.push(`Dale, vai bien, pero este mes se te fue la mano en ${name}.`);
      } else {
        msgs.push(`Lo que más te está pegando este mes es ${name}. Vale la pena mirarlo con calma.`);
      }
    }
  }

  const hasCardHighUtil = (creditHealth ?? []).some((c) => (c.utilizationPct ?? 0) >= 85);
  const hasCardInterest = (creditHealth ?? []).some((c) => c.badges.some((b) => b.key === "interest"));
  if (hasCardHighUtil) {
    msgs.push("Ojo con las tarjetas: tienes una con cupo alto. Un abono parcial te puede dar aire.");
  } else if (hasCardInterest) {
    msgs.push("Hay tarjetas con intereses este período. Si podís, paga un poco más que el mínimo.");
  }

  if (msgs.length === 0) {
    msgs.push("Todo OK por ahora. Mantén el ritmo y registra tus movimientos para ver mejor el mes.");
  }

  return Array.from(new Set(msgs)).slice(0, 3);
}

