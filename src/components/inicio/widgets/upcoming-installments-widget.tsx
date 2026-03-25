"use client";

import { useMemo } from "react";
import { CalendarClock, ChevronRight } from "lucide-react";
import { EmptyStateCard } from "@/components/ui/states";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import type { DebtsSnapshot, DebtorsWidgetSize } from "@/components/inicio/widgets/debtors-widget";

function healthBadge(health: "AL_DIA" | "PROXIMA" | "VENCIDA" | "PAGADA") {
  switch (health) {
    case "VENCIDA":
      return { label: "Atrasada", className: "bg-rose-50 text-rose-700 ring-rose-100" };
    case "PROXIMA":
      return { label: "Próxima", className: "bg-amber-50 text-amber-700 ring-amber-100" };
    case "AL_DIA":
      return { label: "Al día", className: "bg-emerald-50 text-emerald-700 ring-emerald-100" };
    case "PAGADA":
      return { label: "Pagada", className: "bg-slate-50 text-slate-600 ring-slate-100" };
    default:
      return { label: "Pendiente", className: "bg-slate-50 text-slate-600 ring-slate-100" };
  }
}

export function UpcomingInstallmentsWidget({
  data,
  loading,
  error,
  size,
  onViewAll
}: {
  data: DebtsSnapshot | null;
  loading: boolean;
  error: string | null;
  size: DebtorsWidgetSize;
  onViewAll?: () => void;
  }) {
  const items = useMemo(() => {
    const timeline = data?.commitments.upcomingTimeline ?? [];
    const sorted = timeline
      .slice()
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const max = size === "compact" ? 3 : size === "featured" ? 8 : 5;
    return sorted.slice(0, max);
  }, [data?.commitments.upcomingTimeline, size]);

  const timeline = data?.commitments.upcomingTimeline ?? [];
  const monthlyCommitted = data?.commitments.monthlyCommittedTotal ?? 0;
  const upcomingCount = data?.commitments.upcomingCount ?? 0;
  const overdueCount = data?.commitments.overdueCount ?? 0;

  if (error) {
    return (
      <SurfaceCard variant="soft" padding="sm">
        <p className="text-sm font-semibold text-slate-900">Cuotas próximas</p>
        <p className="mt-1 text-sm text-rose-700">{error}</p>
      </SurfaceCard>
    );
  }

  if (!loading && timeline.length === 0) {
    return (
      <EmptyStateCard
        title="No tienes cuotas próximas registradas"
        description="Cuando registres deudas en cuotas, aparecerán aquí los próximos vencimientos."
        actionLabel="Ver pendientes"
        onAction={onViewAll}
        className="shadow-none"
      />
    );
  }

  return (
    <SurfaceCard variant="soft" padding="sm" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-slate-500">
            <CalendarClock className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Cuotas próximas</p>
          </div>
          <p className="mt-1 text-base font-semibold text-slate-900">Cobros próximos</p>
          {size === "compact" ? null : (
            <p className="mt-1 text-sm text-slate-600">Lo que viene pronto y lo vencido.</p>
          )}
        </div>
        {size === "featured" && onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="tap-feedback inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Ver todos
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {size === "compact" ? (
        <div className="rounded-2xl border border-slate-100 bg-white/80 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Total por cobrar (mes)
          </p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <p className="text-2xl font-semibold tracking-tight text-slate-900">
              {loading ? "..." : formatCurrency(monthlyCommitted)}
            </p>
            <p className="text-sm font-semibold text-slate-600">
              Vencidas: <span className="text-rose-600">{loading ? "…" : overdueCount}</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-white/80 p-3 sm:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Total por cobrar (mes)
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {loading ? "..." : formatCurrency(monthlyCommitted)}
            </p>
          </div>
          <div className="grid gap-2">
            <div className="rounded-2xl border border-slate-100 bg-white/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Próximas</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{loading ? "…" : upcomingCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Vencidas</p>
              <p className="mt-1 text-lg font-semibold text-rose-600">{loading ? "…" : overdueCount}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => {
          const badge = healthBadge(item.health);
          return (
            <div
              key={item.debtId}
              className="rounded-2xl border border-slate-100 bg-white/80 px-3.5 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.debtName}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{item.reason}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${badge.className}`}>
                  {badge.label}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                <span>{formatDate(item.dueDate)}</span>
                <span className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
              </div>
            </div>
          );
        })}

        {size !== "featured" && onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="tap-feedback flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-white"
          >
            Ver todos los pendientes
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
