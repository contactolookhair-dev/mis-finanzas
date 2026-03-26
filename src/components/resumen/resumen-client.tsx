"use client";

import { useEffect, useMemo, useState } from "react";
import { FinancialHealthCenter } from "@/components/health/financial-health-center";
import { MonthlyReportSection } from "@/components/reports/monthly-report-section";
import { ErrorStateCard } from "@/components/ui/states";
import { SectionHeader } from "@/components/ui/section-header";
import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";
import type { DashboardSnapshot } from "@/shared/types/dashboard";
import type { FinancialHealthResponse } from "@/shared/types/financial-health";

type DebtsTotals = {
  pendingTotal: number;
  collectedTotal: number;
};

type CreditHealthItem = {
  accountId: string;
  name: string;
  bank: string | null;
  periodLabel: string;
  utilizationPct: number | null;
  badges: Array<{ key: string; label: string; tone: "alert" | "attention" | "positive" | "info" }>;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function pickResumenMensajes(input: {
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

  // De-dup and cap.
  return Array.from(new Set(msgs)).slice(0, 3);
}

export function ResumenClient() {
  const [spent, setSpent] = useState<number | null>(null);
  const [collected, setCollected] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [financialHealth, setFinancialHealth] = useState<FinancialHealthResponse | null>(null);
  const [financialHealthLoading, setFinancialHealthLoading] = useState(false);
  const [financialHealthError, setFinancialHealthError] = useState<string | null>(null);
  const [reportFilters, setReportFilters] = useState<DashboardSnapshot["filters"] | null>(null);
  const [reportPeriodLabel, setReportPeriodLabel] = useState<string | null>(null);
  const [dashboardSnapshot, setDashboardSnapshot] = useState<DashboardSnapshot | null>(null);
  const [creditHealth, setCreditHealth] = useState<CreditHealthItem[] | null>(null);

  useEffect(() => {
    async function loadSummary() {
      try {
        setError(null);
        const [dashboardResponse, debtsResponse, creditResponse] = await Promise.all([
          fetch("/api/dashboard", { cache: "no-store" }),
          fetch("/api/debts", { cache: "no-store" }),
          fetch("/api/accounts/credit/health", { cache: "no-store" })
        ]);

        if (!dashboardResponse.ok || !debtsResponse.ok) {
          throw new Error("No se pudo cargar el resumen.");
        }

        const dashboard = (await dashboardResponse.json()) as DashboardSnapshot;
        const debts = (await debtsResponse.json()) as {
          totals: DebtsTotals;
        };

        setSpent(Math.abs(dashboard.kpis.expenses));
        setCollected(Math.abs(debts.totals.collectedTotal));
        setPending(Math.abs(debts.totals.pendingTotal));
        setReportFilters(dashboard.filters);
        setReportPeriodLabel(dashboard.comparisons.currentPeriodLabel);
        setDashboardSnapshot(dashboard);
        void loadFinancialHealth(dashboard.filters);

        if (creditResponse.ok) {
          const payload = (await creditResponse.json()) as { items?: CreditHealthItem[] };
          setCreditHealth(payload.items ?? []);
        } else {
          setCreditHealth([]);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Error cargando resumen.");
      }
    }

    void loadSummary();
  }, []);

  const mensajes = useMemo(() => {
    if (!dashboardSnapshot) return [];
    return pickResumenMensajes({ dashboard: dashboardSnapshot, creditHealth });
  }, [dashboardSnapshot, creditHealth]);

  async function loadFinancialHealth(filters: DashboardSnapshot["filters"]) {
    try {
      setFinancialHealthLoading(true);
      setFinancialHealthError(null);

      const params = new URLSearchParams();
      Object.entries(filters ?? {}).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });

      const response = await fetch(
        `/api/health/financial${params.toString() ? `?${params.toString()}` : ""}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "No se pudo cargar la salud financiera.");
      }

      const payload = (await response.json()) as FinancialHealthResponse;
      setFinancialHealth(payload);
    } catch (loadError) {
      setFinancialHealthError(
        loadError instanceof Error ? loadError.message : "No se pudo cargar la salud financiera."
      );
    } finally {
      setFinancialHealthLoading(false);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <SectionHeader
        eyebrow="Resumen"
        title="Vista rápida"
        description="Una lectura simple de lo que ya gastaste, cobraste y sigues teniendo pendiente."
        actions={<StatPill tone="premium">Estado mensual</StatPill>}
      />

      {error ? (
        <ErrorStateCard title="No se pudo cargar el resumen" description={error} />
      ) : null}

      {mensajes.length ? (
        <SurfaceCard
          variant="soft"
          padding="sm"
          className="border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,251,235,0.92)_0%,rgba(255,255,255,0.92)_100%)] shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-800/80">Tu nota del mes</p>
              <div className="mt-2 space-y-2">
                {mensajes.map((m) => (
                  <p key={m} className="text-sm font-semibold leading-relaxed text-slate-900">
                    {m}
                  </p>
                ))}
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-amber-200 bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
              Resumen
            </span>
          </div>
        </SurfaceCard>
      ) : null}

      <MonthlyReportSection filters={reportFilters} periodLabel={reportPeriodLabel} />
      <FinancialHealthCenter data={financialHealth} loading={financialHealthLoading} />
      {financialHealthError ? (
        <ErrorStateCard
          title="No se pudo cargar la salud financiera"
          description={financialHealthError}
        />
      ) : null}
      <section className="grid gap-3 sm:grid-cols-3">
        <SurfaceCard variant="soft" padding="sm">
          <p className="text-xs text-neutral-500">Gastado</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {spent === null ? "..." : formatCurrency(spent)}
          </p>
        </SurfaceCard>
        <SurfaceCard variant="soft" padding="sm">
          <p className="text-xs text-neutral-500">Cobrado</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {collected === null ? "..." : formatCurrency(collected)}
          </p>
        </SurfaceCard>
        <SurfaceCard variant="soft" padding="sm">
          <p className="text-xs text-neutral-500">Pendiente</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {pending === null ? "..." : formatCurrency(pending)}
          </p>
        </SurfaceCard>
      </section>
    </div>
  );
}
