"use client";

import { useEffect, useState } from "react";
import { ExportActions } from "@/components/exports/export-actions";
import { FinancialHealthCenter } from "@/components/health/financial-health-center";
import { MonthlyReportSection } from "@/components/reports/monthly-report-section";
import { SectionHeader } from "@/components/ui/section-header";
import { ErrorStateCard, SkeletonCard } from "@/components/ui/states";
import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";
import type { DashboardSnapshot } from "@/shared/types/dashboard";
import type { FinancialHealthResponse } from "@/shared/types/financial-health";

export function ReportesClient() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [financialHealth, setFinancialHealth] = useState<FinancialHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/dashboard", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("No se pudieron cargar los reportes.");
        }

        const payload = (await response.json()) as DashboardSnapshot;
        setSnapshot(payload);
        void loadFinancialHealth(payload.filters);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Error cargando reportes.");
      } finally {
        setLoading(false);
      }
    }

    async function loadFinancialHealth(filters: DashboardSnapshot["filters"]) {
      try {
        setHealthLoading(true);
        setHealthError(null);

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
        setHealthError(
          loadError instanceof Error ? loadError.message : "No se pudo cargar la salud financiera."
        );
      } finally {
        setHealthLoading(false);
      }
    }

    void loadData();
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Reportes"
        title="Centro de reportes"
        description="Exporta, revisa y comparte tu estado financiero con una vista clara y profesional."
        actions={<StatPill tone="premium">Mensual y filtrable</StatPill>}
      />

      {loading ? <SkeletonCard lines={4} /> : null}
      {error ? (
        <ErrorStateCard title="No se pudieron cargar los reportes" description={error} />
      ) : null}

      {!loading && !error && snapshot ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <SurfaceCard variant="soft" padding="sm">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Ingresos</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">
                {formatCurrency(Math.abs(snapshot.kpis.incomes))}
              </p>
            </SurfaceCard>
            <SurfaceCard variant="soft" padding="sm">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Gastos</p>
              <p className="mt-2 text-2xl font-semibold text-fuchsia-600">
                {formatCurrency(Math.abs(snapshot.kpis.expenses))}
              </p>
            </SurfaceCard>
            <SurfaceCard variant="soft" padding="sm">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Flujo neto</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatCurrency(snapshot.kpis.netFlow)}
              </p>
            </SurfaceCard>
          </section>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <MonthlyReportSection
                filters={snapshot.filters}
                periodLabel={snapshot.comparisons.currentPeriodLabel}
              />
              <FinancialHealthCenter data={financialHealth} loading={healthLoading} />
              {healthError ? (
                <ErrorStateCard
                  title="No se pudo cargar la salud financiera"
                  description={healthError}
                />
              ) : null}
            </div>

            <div className="space-y-4">
              <ExportActions filters={snapshot.filters} />
              <SurfaceCard variant="highlight" className="space-y-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Qué incluye el reporte
                </p>
                <p className="text-lg font-semibold text-slate-900">Resumen listo para compartir</p>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>Periodo actual y comparativa básica.</p>
                  <p>Ingresos, gastos, ahorro y estado financiero.</p>
                  <p>Compromisos, alertas y gastos hormiga detectados.</p>
                </div>
              </SurfaceCard>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

