"use client";

import { BrainCircuit, Loader2, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import { EmptyStateCard, ErrorStateCard, SkeletonCard } from "@/components/ui/states";
import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";
import type { FinancialInsightsResponse } from "@/shared/types/financial-insights";

function severityStyles(severity: "info" | "warning" | "critical") {
  if (severity === "critical") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (severity === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function priorityStyles(priority: "high" | "medium" | "low") {
  if (priority === "high") {
    return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700";
  }
  if (priority === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function FinancialInsightsPanel({
  loading,
  error,
  response
}: {
  loading: boolean;
  error: string | null;
  response: FinancialInsightsResponse | null;
}) {
  return (
    <SurfaceCard variant="highlight" padding="sm" className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-violet-600" />
            <h3 className="text-lg font-semibold text-slate-900">IA Financiera</h3>
          </div>
          <p className="max-w-2xl text-sm text-slate-500">
            Pulsa el botón superior para revisar tu flujo, categorías, gastos hormiga, alertas y
            recomendaciones usando datos reales del workspace.
          </p>
        </div>
        {loading ? (
          <StatPill tone="premium">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Analizando...
          </StatPill>
        ) : null}
      </div>

      {error ? <ErrorStateCard title="No se pudo generar el análisis" description={error} /> : null}

      {!response && !loading ? (
        <EmptyStateCard
          title="Sin análisis todavía"
          description="Pulsa Analizar mis finanzas para ver resumen, alertas y recomendaciones."
        />
      ) : null}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={4} className="md:col-span-2" />
        </div>
      ) : null}

      {response ? (
        <div className="space-y-4">
          <SurfaceCard
            variant="dark"
            className="rounded-[26px] border border-violet-100 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-emerald-500 p-5 text-white"
          >
            <p className="text-xs uppercase tracking-[0.22em] text-white/70">Resumen IA</p>
            <p className="mt-3 text-base leading-7 text-white/90">{response.summary}</p>
          </SurfaceCard>

          <section className="grid gap-4 md:grid-cols-2">
            <SurfaceCard variant="soft" padding="sm" className="rounded-[26px]">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <h4 className="text-sm font-semibold text-slate-900">Top categorías</h4>
              </div>
              <div className="mt-4 space-y-3">
                {response.topCategories.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay categorías suficientes para analizar.</p>
                ) : (
                  response.topCategories.map((item) => (
                    <div key={item.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-900">{item.name}</span>
                        <span className="text-slate-500">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-emerald-500"
                          style={{ width: `${Math.min(item.percentage, 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        {item.percentage.toFixed(1)}% del gasto · {item.count} movimientos
                      </p>
                    </div>
                  ))
                )}
              </div>
            </SurfaceCard>

            <SurfaceCard variant="soft" padding="sm" className="rounded-[26px]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-fuchsia-600" />
                <h4 className="text-sm font-semibold text-slate-900">Gastos hormiga</h4>
              </div>
              <div className="mt-4 space-y-3">
                {response.gastosHormiga.length === 0 ? (
                  <p className="text-sm text-slate-500">No detecté hábitos pequeños repetitivos en este período.</p>
                ) : (
                  response.gastosHormiga.map((item) => (
                    <div key={item.id} className="rounded-[22px] border border-slate-100 bg-slate-50/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.description}</p>
                          <p className="text-xs text-slate-500">{item.category} · {item.count} veces</p>
                        </div>
                        <p className="text-sm font-semibold text-fuchsia-600">{formatCurrency(item.amount)}</p>
                      </div>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                        Promedio {formatCurrency(item.average)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </SurfaceCard>

            <SurfaceCard variant="soft" padding="sm" className="rounded-[26px]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h4 className="text-sm font-semibold text-slate-900">Alertas</h4>
              </div>
              <div className="mt-4 space-y-3">
                {response.alerts.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay alertas relevantes por ahora.</p>
                ) : (
                  response.alerts.map((item) => (
                    <div key={item.id} className={`rounded-[22px] border px-3 py-3 text-sm ${severityStyles(item.severity)}`}>
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 text-sm opacity-90">{item.description}</p>
                    </div>
                  ))
                )}
              </div>
            </SurfaceCard>

            <SurfaceCard variant="soft" padding="sm" className="rounded-[26px]">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-violet-600" />
                <h4 className="text-sm font-semibold text-slate-900">Recomendaciones</h4>
              </div>
              <div className="mt-4 space-y-3">
                {response.recommendations.length === 0 ? (
                  <p className="text-sm text-slate-500">Aún no hay recomendaciones para este período.</p>
                ) : (
                  response.recommendations.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-[22px] border px-3 py-3 text-sm ${priorityStyles(item.priority)}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{item.title}</p>
                        <span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]">
                          {item.priority}
                        </span>
                      </div>
                      <p className="mt-1 opacity-90">{item.description}</p>
                    </div>
                  ))
                )}
              </div>
            </SurfaceCard>
          </section>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-500">
            Fuente: {response.source === "gemini" ? `Gemini ${response.model}` : `Fallback local ${response.model}`}
          </div>
        </div>
      ) : null}
    </SurfaceCard>
  );
}
