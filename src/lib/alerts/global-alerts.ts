import { formatCurrency } from "@/lib/formatters/currency";
import type { DashboardSnapshot } from "@/shared/types/dashboard";
import type { FinancialHealthResponse } from "@/shared/types/financial-health";
import type { CreditHealthLike } from "@/lib/accounts/credit-attention";

export type GlobalAlertTone = "critical" | "attention" | "info" | "positive";

export type GlobalAlertAction = {
  label: string;
  href: string;
};

export type GlobalAlert = {
  id: string;
  tone: GlobalAlertTone;
  title: string;
  description: string;
  action?: GlobalAlertAction;
  score: number;
};

type CreditHealthItem = CreditHealthLike & {
  accountId: string;
  name: string;
  bank: string | null;
  periodLabel: string;
  importBatchId: string;
  importedAt?: string;
  utilizationPct: number | null;
};

export type DebtsSnapshotLike = {
  people: Array<{
    id: string;
    name: string;
    pendingAmount: number;
    installmentStatus: "AL_DIA" | "PROXIMA" | "VENCIDA" | "PAGADA";
    nextInstallmentDate: string | null;
  }>;
  totals: { pendingPeople: number };
  commitments: {
    upcomingCount: number;
    overdueCount: number;
    nextDueDate: string | null;
    nextDueDebtName: string | null;
  };
};

export type PayablesSnapshotLike = {
  items: Array<{
    id: string;
    origin: string;
    amount: number;
    dueDate: string;
    paidAt: string | null;
  }>;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function ymd(iso: string) {
  return iso.slice(0, 10);
}

function daysUntil(iso: string) {
  const today = new Date();
  const base = new Date(`${ymd(iso)}T12:00:00`);
  const diff = base.getTime() - today.setHours(12, 0, 0, 0);
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function toneRank(tone: GlobalAlertTone) {
  return tone === "critical" ? 0 : tone === "attention" ? 1 : tone === "info" ? 2 : 3;
}

export function generateGlobalAlerts(input: {
  dashboard: DashboardSnapshot | null;
  financialHealth: FinancialHealthResponse | null;
  creditHealth: CreditHealthItem[];
  debts: DebtsSnapshotLike | null;
  payables: PayablesSnapshotLike | null;
}) {
  const { dashboard, financialHealth, creditHealth, debts, payables } = input;
  const alerts: GlobalAlert[] = [];

  const topCredit = creditHealth[0] ?? null;
  if (topCredit) {
    if ((topCredit.utilizationPct ?? 0) >= 90) {
      alerts.push({
        id: `cc_util_${topCredit.accountId}`,
        tone: "critical",
        title: "Cupo muy alto en tarjeta",
        description: `${topCredit.name} está en ${topCredit.utilizationPct}% de uso.`,
        action: { label: "Ver tarjeta", href: `/cuentas?card=${encodeURIComponent(topCredit.accountId)}` },
        score: 100
      });
    } else if ((topCredit.utilizationPct ?? 0) >= 70) {
      alerts.push({
        id: `cc_util_hi_${topCredit.accountId}`,
        tone: "attention",
        title: "Cupo alto en tarjeta",
        description: `${topCredit.name} está en ${topCredit.utilizationPct}% de uso.`,
        action: { label: "Ver tarjeta", href: `/cuentas?card=${encodeURIComponent(topCredit.accountId)}` },
        score: 78
      });
    }

    if (topCredit.totals.cashAdvances > 0) {
      alerts.push({
        id: `cc_adv_${topCredit.accountId}`,
        tone: "critical",
        title: "Avances detectados",
        description: `${topCredit.name}: ${formatCurrency(topCredit.totals.cashAdvances)} este período.`,
        action: { label: "Ver tarjeta", href: `/cuentas?card=${encodeURIComponent(topCredit.accountId)}` },
        score: 96
      });
    }

    if (topCredit.totals.interest > 0) {
      alerts.push({
        id: `cc_int_${topCredit.accountId}`,
        tone: "attention",
        title: "Intereses en tarjeta",
        description: `${topCredit.name}: ${formatCurrency(topCredit.totals.interest)} este período.`,
        action: { label: "Ver tarjeta", href: `/cuentas?card=${encodeURIComponent(topCredit.accountId)}` },
        score: 70
      });
    }

    if (topCredit.totals.fees > 0) {
      alerts.push({
        id: `cc_fee_${topCredit.accountId}`,
        tone: "info",
        title: "Comisiones en tarjeta",
        description: `${topCredit.name}: ${formatCurrency(topCredit.totals.fees)} este período.`,
        action: { label: "Ver tarjeta", href: `/cuentas?card=${encodeURIComponent(topCredit.accountId)}` },
        score: 55
      });
    }

    if (topCredit.totals.dubiousCount > 0 || topCredit.badges.some((b) => b.key === "review")) {
      alerts.push({
        id: `cc_review_${topCredit.accountId}`,
        tone: "info",
        title: "Revisar importación",
        description:
          topCredit.totals.dubiousCount > 0
            ? `${topCredit.name}: ${topCredit.totals.dubiousCount} movimientos dudosos.`
            : `${topCredit.name}: conviene revisar el estado importado.`,
        action: { label: "Ver importación", href: `/importaciones?batchId=${encodeURIComponent(topCredit.importBatchId)}` },
        score: 52
      });
    }
  }

  if (payables?.items?.length) {
    const todayISO = new Date().toISOString().slice(0, 10);
    const pending = payables.items.filter((p) => !p.paidAt);
    const overdue = pending.filter((p) => ymd(p.dueDate) < todayISO);
    const upcoming = pending
      .map((p) => ({ p, days: daysUntil(p.dueDate) }))
      .filter((x) => x.days >= 0)
      .sort((a, b) => a.days - b.days)[0]?.p ?? null;

    if (overdue.length) {
      alerts.push({
        id: "payables_overdue",
        tone: "critical",
        title: "Pendientes vencidos",
        description: `Tienes ${overdue.length} pago(s) vencido(s) por cubrir.`,
        action: { label: "Ver pendientes", href: "/pendientes?tab=debo-pagar" },
        score: 92
      });
    } else if (upcoming) {
      const d = daysUntil(upcoming.dueDate);
      if (d <= 3) {
        alerts.push({
          id: `payables_soon_${upcoming.id}`,
          tone: "attention",
          title: "Pago próximo",
          description: `${upcoming.origin}: vence en ${d} día(s) (${formatCurrency(upcoming.amount)}).`,
          action: { label: "Ver pendientes", href: "/pendientes?tab=debo-pagar" },
          score: 64
        });
      }
    }
  }

  if (debts) {
    if (debts.commitments.overdueCount > 0) {
      alerts.push({
        id: "debts_overdue",
        tone: "attention",
        title: "Cobros atrasados",
        description: `Tienes ${debts.commitments.overdueCount} cobro(s) atrasado(s) por perseguir.`,
        action: { label: "Ver pendientes", href: "/pendientes" },
        score: 62
      });
    } else if (debts.commitments.upcomingCount > 0 && debts.commitments.nextDueDate) {
      const d = daysUntil(debts.commitments.nextDueDate);
      alerts.push({
        id: "debts_next_due",
        tone: "info",
        title: "Cobro próximo",
        description: `${debts.commitments.nextDueDebtName ?? "Un cobro"} vence en ${Math.max(0, d)} día(s).`,
        action: { label: "Ver pendientes", href: "/pendientes" },
        score: 44
      });
    }
  }

  if (dashboard) {
    const expenses = Math.abs(dashboard.kpis.expenses);
    const topCategory = dashboard.charts.categories?.[0] ?? null;
    if (topCategory && expenses > 0) {
      const share = topCategory.value / expenses;
      const name = topCategory.name;
      const n = normalizeText(name);
      const isFood = n.includes("comida") || n.includes("delivery") || n.includes("rest") || n.includes("salida");
      if (isFood && share >= 0.28) {
        alerts.push({
          id: "spend_food",
          tone: share >= 0.35 ? "attention" : "info",
          title: "Gasto alto en comida/salidas",
          description: `${name} está pesando ${(share * 100).toFixed(0)}% de tus gastos del mes.`,
          action: { label: "Ver movimientos", href: "/movimientos" },
          score: share >= 0.35 ? 60 : 48
        });
      }
    }

    const expDeltaPct = dashboard.comparisons.expenses.deltaPct;
    if (expDeltaPct >= 0.22) {
      alerts.push({
        id: "spend_up",
        tone: "attention",
        title: "Gastos subiendo",
        description: `Estás gastando +${Math.round(expDeltaPct * 100)}% vs el mes pasado.`,
        action: { label: "Ver movimientos", href: "/movimientos" },
        score: 58
      });
    } else if (expDeltaPct <= -0.12) {
      alerts.push({
        id: "spend_down",
        tone: "positive",
        title: "Buena señal",
        description: `Bajaste tus gastos vs el mes pasado.`,
        score: 20
      });
    }
  }

  if (financialHealth?.alerts?.length) {
    const a = financialHealth.alerts[0];
    alerts.push({
      id: `fh_${a.id}`,
      tone: a.severity === "critical" ? "critical" : a.severity === "warning" ? "attention" : "info",
      title: a.title,
      description: a.description,
      action: { label: "Ver salud", href: "/resumen" },
      score: a.severity === "critical" ? 88 : a.severity === "warning" ? 66 : 40
    });
  }

  // De-dup by id and sort.
  const byId = new Map<string, GlobalAlert>();
  for (const a of alerts) {
    const prev = byId.get(a.id);
    if (!prev || a.score > prev.score) byId.set(a.id, a);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const tr = toneRank(a.tone) - toneRank(b.tone);
    if (tr !== 0) return tr;
    return b.score - a.score;
  });
}
