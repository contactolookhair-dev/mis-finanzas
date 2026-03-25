"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    async function loadSummary() {
      try {
        setError(null);
        const [dashboardResponse, debtsResponse] = await Promise.all([
          fetch("/api/dashboard", { cache: "no-store" }),
          fetch("/api/debts", { cache: "no-store" })
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
        void loadFinancialHealth(dashboard.filters);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Error cargando resumen.");
      }
    }

    void loadSummary();
  }, []);

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
