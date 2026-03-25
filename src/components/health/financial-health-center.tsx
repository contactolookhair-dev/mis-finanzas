"use client";

import { useState } from "react";
import { AlertTriangle, CalendarDays, ShieldCheck, Sparkles, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyStateCard } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters/currency";
import type { FinancialHealthResponse } from "@/shared/types/financial-health";

function statusTone(status: FinancialHealthResponse["status"]) {
  switch (status) {
    case "saludable":
      return "success";
    case "atencion":
      return "warning";
    default:
      return "danger";
  }
}

function statusCopy(status: FinancialHealthResponse["status"]) {
  switch (status) {
    case "saludable":
      return "Saludable";
    case "atencion":
      return "Atención";
    default:
      return "Crítico";
  }
}

function loadingCard() {
  return (
    <Card className="rounded-[28px] border border-white/70 bg-white/88 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.07)] sm:p-5">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-40 rounded-full bg-slate-200/80" />
        <div className="h-10 w-72 rounded-2xl bg-slate-200/70" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 rounded-[22px] bg-slate-100" />
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="h-40 rounded-[24px] bg-slate-100" />
          <div className="h-40 rounded-[24px] bg-slate-100" />
        </div>
      </div>
    </Card>
  );
}

export function FinancialHealthCenter({
  data,
  loading = false
}: {
  data: FinancialHealthResponse | null;
  loading?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (loading && !data) {
    return loadingCard();
  }

  if (!data) {
    return (
      <EmptyStateCard
        title="Salud financiera en preparación"
        description="Cuando registres algunos movimientos, aquí verás alertas, patrones y compromisos del mes."
        actionLabel="Registrar movimiento"
        onAction={() => {
          const button = document.querySelector<HTMLButtonElement>("[aria-label='Nueva transacción']");
          button?.click();
        }}
      />
    );
  }

  const topCategory = data.metrics.topExpenseCategory;
  const committedTone =
    data.metrics.committedDebtPct < 20 ? "text-emerald-600" : data.metrics.committedDebtPct < 35 ? "text-amber-600" : "text-rose-600";
  const compactMetrics = [
    {
      label: "Ahorro",
      value: formatCurrency(data.metrics.savings),
      tone: data.metrics.savings >= 0 ? "text-emerald-700" : "text-rose-700"
    },
    {
      label: "Deuda comprometida",
      value: `${data.metrics.committedDebtPct.toFixed(1)}%`,
      tone: committedTone
    },
    {
      label: "Gasto vs anterior",
      value: `${data.metrics.expenseComparison.deltaPct >= 0 ? "+" : ""}${data.metrics.expenseComparison.deltaPct.toFixed(1)}%`,
      tone:
        data.metrics.expenseComparison.deltaPct <= 0
          ? "text-emerald-700"
          : data.metrics.expenseComparison.deltaPct < 15
            ? "text-amber-700"
            : "text-rose-700"
    }
  ] as const;
  const metricCards = [
    {
      label: "Ahorro actual",
      value: formatCurrency(data.metrics.savings),
      tone: data.metrics.savings >= 0 ? "text-emerald-600" : "text-rose-600",
      icon: ShieldCheck
    },
    {
      label: "Gasto vs mes anterior",
      value: `${data.metrics.expenseComparison.deltaPct >= 0 ? "+" : ""}${data.metrics.expenseComparison.deltaPct.toFixed(1)}%`,
      tone:
        data.metrics.expenseComparison.deltaPct <= 0
          ? "text-emerald-600"
          : data.metrics.expenseComparison.deltaPct < 15
            ? "text-amber-600"
            : "text-rose-600",
      icon: TrendingDown
    },
    {
      label: "Comprometido en deudas",
      value: `${data.metrics.committedDebtPct.toFixed(1)}%`,
      tone: committedTone,
      icon: CalendarDays
    },
    {
      label: "Cuotas vencidas",
      value: `${data.metrics.overdueCount}`,
      tone: data.metrics.overdueCount === 0 ? "text-emerald-600" : "text-rose-600",
      icon: AlertTriangle
    }
  ] as const;

  return (
    <section className="space-y-4">
      <div className="lg:hidden">
        <Card
          className={cn(
            "relative overflow-hidden rounded-[28px] border p-4 shadow-[0_18px_44px_rgba(15,23,42,0.08)]",
            data.status === "saludable"
              ? "border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50"
              : data.status === "atencion"
                ? "border-amber-100 bg-gradient-to-br from-amber-50 via-white to-fuchsia-50"
                : "border-rose-100 bg-gradient-to-br from-rose-50 via-white to-violet-50"
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.95),transparent_45%)]" />
          <div className="relative space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(data.status)}>{statusCopy(data.status)}</Badge>
                  <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                    {data.periodLabel}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                    Centro de salud financiera
                  </p>
                  <h3 className="mt-1 text-xl font-semibold leading-tight text-slate-900">
                    {data.headline}
                  </h3>
                </div>
              </div>
              <div
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-full border-6 text-base font-semibold shadow-sm",
                  data.status === "saludable"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : data.status === "atencion"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                )}
                style={{
                  backgroundImage: `conic-gradient(${data.status === "saludable" ? "#10b981" : data.status === "atencion" ? "#f59e0b" : "#f43f5e"} ${data.score}%, rgba(226,232,240,0.6) 0)`
                }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-900">
                  {data.score}
                </div>
              </div>
            </div>

            <p className="text-sm leading-6 text-slate-600">{data.summary}</p>

            <div className="grid grid-cols-3 gap-2">
              {compactMetrics.map((metric) => (
                <div key={metric.label} className="rounded-[18px] border border-white/70 bg-white/80 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
                  <p className={cn("mt-1 text-sm font-semibold", metric.tone)}>{metric.value}</p>
                </div>
              ))}
            </div>

            {data.alerts[0] ? (
              <div className="rounded-[18px] border border-slate-100 bg-white/80 p-3">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-2xl",
                      data.alerts[0].severity === "critical"
                        ? "bg-rose-100 text-rose-700"
                        : data.alerts[0].severity === "warning"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                    )}
                  >
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{data.alerts[0].title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-600">
                      {data.alerts[0].description}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
              >
                {expanded ? "Ocultar detalle" : "Ver detalle"}
              </button>
              <span className="text-[11px] text-slate-500">
                {expanded ? "Vista completa activada" : "Resumen compacto"}
              </span>
            </div>
          </div>
        </Card>

      </div>

      <div className={cn(expanded ? "block" : "hidden", "lg:block")}>
        <Card
          className={cn(
            "relative overflow-hidden rounded-[30px] border p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] sm:p-6",
            data.status === "saludable"
              ? "border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50"
              : data.status === "atencion"
                ? "border-amber-100 bg-gradient-to-br from-amber-50 via-white to-fuchsia-50"
                : "border-rose-100 bg-gradient-to-br from-rose-50 via-white to-violet-50"
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.9),transparent_42%)]" />
          <div className="relative grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(data.status)}>{statusCopy(data.status)}</Badge>
                <span className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                  {data.periodLabel}
                </span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Centro de salud financiera
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
                  {data.headline}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  {data.summary}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {data.factors.slice(0, 4).map((factor) => (
                  <span
                    key={factor.id}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
                      factor.tone === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : factor.tone === "warning"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : factor.tone === "danger"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-slate-200 bg-white text-slate-600"
                    )}
                  >
                    <span className="text-[10px] uppercase tracking-[0.18em] opacity-70">{factor.label}</span>
                    <span>{factor.value}</span>
                  </span>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metricCards.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <div
                      key={metric.label}
                      className="rounded-[22px] border border-white/70 bg-white/80 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
                          <p className={cn("mt-2 text-2xl font-semibold", metric.tone)}>{metric.value}</p>
                        </div>
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                          <Icon className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[26px] border border-white/70 bg-white/85 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Semáforo general</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">Puntaje {data.score}/100</p>
                  </div>
                  <div
                    className={cn(
                      "flex h-20 w-20 items-center justify-center rounded-full border-8 text-lg font-semibold",
                      data.status === "saludable"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : data.status === "atencion"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                    )}
                    style={{
                      backgroundImage: `conic-gradient(${data.status === "saludable" ? "#10b981" : data.status === "atencion" ? "#f59e0b" : "#f43f5e"} ${data.score}%, rgba(226,232,240,0.6) 0)`
                    }}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-900 shadow-sm">
                      {data.score}
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      <span>Flujo comprometido</span>
                      <span>{data.metrics.committedDebtPct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className={cn(
                          "h-2 rounded-full",
                          data.metrics.committedDebtPct < 20
                            ? "bg-emerald-500"
                            : data.metrics.committedDebtPct < 35
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        )}
                        style={{ width: `${Math.min(100, data.metrics.committedDebtPct)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Categoría principal</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">
                      {topCategory ? topCategory.name : "Sin categoría"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {topCategory
                        ? `${formatCurrency(topCategory.amount)} · ${topCategory.percentage.toFixed(1)}% del gasto`
                        : "No hay suficientes movimientos para identificar una categoría principal."}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Próximos vencimientos</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{data.metrics.upcomingCount}</p>
                    </div>
                    <div className="rounded-[18px] border border-slate-100 bg-slate-50/70 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Cuotas vencidas</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{data.metrics.overdueCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/70 bg-white/85 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Alertas clave</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">Lo más importante ahora</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    <Sparkles className="h-3.5 w-3.5" />
                    {data.metrics.alertCount} alertas
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {data.alerts.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-sm text-slate-500">
                      Sin alertas relevantes por ahora.
                    </div>
                  ) : (
                    data.alerts.slice(0, 3).map((alert) => (
                      <div
                        key={alert.id}
                        className={cn(
                          "rounded-[18px] border px-3 py-3",
                          alert.severity === "critical"
                            ? "border-rose-200 bg-rose-50/80"
                            : alert.severity === "warning"
                              ? "border-amber-200 bg-amber-50/80"
                              : "border-slate-200 bg-slate-50/80"
                        )}
                      >
                        <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{alert.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="rounded-[28px] border border-white/75 bg-white/90 p-5 shadow-[0_14px_38px_rgba(15,23,42,0.07)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Gastos hormiga</p>
                <h4 className="mt-1 text-lg font-semibold text-slate-900">Patrones repetitivos detectados</h4>
              </div>
              <Badge tone={data.gastosHormiga.length > 0 ? "warning" : "success"}>
                {data.gastosHormiga.length > 0 ? "Detectados" : "Sin patrones"}
              </Badge>
            </div>
            <div className="mt-4 space-y-2">
              {data.gastosHormiga.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-sm text-slate-500">
                  Sin patrones repetitivos detectados.
                </div>
              ) : (
                data.gastosHormiga.slice(0, 3).map((item) => (
                  <div key={item.id} className="rounded-[18px] border border-slate-100 bg-slate-50/80 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.description}</p>
                        <p className="text-xs text-slate-500">{item.category}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {item.count} movimientos · promedio {formatCurrency(item.average)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="rounded-[28px] border border-white/75 bg-white/90 p-5 shadow-[0_14px_38px_rgba(15,23,42,0.07)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Próximos vencimientos</p>
                <h4 className="mt-1 text-lg font-semibold text-slate-900">Timeline de deudas</h4>
              </div>
              <Badge tone={data.metrics.overdueCount > 0 ? "danger" : "neutral"}>
                {data.metrics.overdueCount > 0 ? `${data.metrics.overdueCount} vencidas` : "Al día"}
              </Badge>
            </div>
            <div className="mt-4 space-y-2">
              {data.upcomingTimeline.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-sm text-slate-500">
                  No hay cuotas próximas para este período.
                </div>
              ) : (
                data.upcomingTimeline.slice(0, 4).map((item) => (
                  <div key={`${item.debtId}-${item.dueDate}`} className="rounded-[18px] border border-slate-100 bg-slate-50/80 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.debtName}</p>
                        <p className="text-xs text-slate-500">{item.reason}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-medium",
                          item.health === "VENCIDA"
                            ? "bg-rose-50 text-rose-700"
                            : item.health === "PROXIMA"
                              ? "bg-amber-50 text-amber-700"
                              : item.health === "PAGADA"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {item.health === "VENCIDA"
                          ? "Vencida"
                          : item.health === "PROXIMA"
                            ? "Próxima a vencer"
                            : item.health === "PAGADA"
                              ? "Pagada"
                              : "Al día"}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(item.dueDate).toLocaleDateString("es-CL")} · {item.daysUntilDue} días
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
