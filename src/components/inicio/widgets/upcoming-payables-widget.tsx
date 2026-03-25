"use client";

import { useMemo } from "react";
import { CalendarClock, ChevronRight } from "lucide-react";
import { EmptyStateCard } from "@/components/ui/states";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";

export type PayableItem = {
  id: string;
  origin: string;
  amount: number;
  dueDate: string; // ISO
  paidAt: string | null;
  notes: string | null;
};

export type PayablesSnapshot = { items: PayableItem[] };

type WidgetSize = "compact" | "standard" | "featured";

function todayISODate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function statusForPayable(item: PayableItem, todayISO: string) {
  if (item.paidAt) return { key: "PAGADO" as const, label: "Pagado", className: "bg-slate-50 text-slate-600 ring-slate-100" };
  const dueISO = item.dueDate.slice(0, 10);
  if (dueISO < todayISO) return { key: "VENCIDO" as const, label: "Vencido", className: "bg-rose-50 text-rose-700 ring-rose-100" };
  return { key: "PROXIMO" as const, label: "Próximo", className: "bg-amber-50 text-amber-700 ring-amber-100" };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function UpcomingPayablesWidget({
  data,
  loading,
  error,
  size,
  onViewAll
}: {
  data: PayablesSnapshot | null;
  loading: boolean;
  error: string | null;
  size: WidgetSize;
  onViewAll?: () => void;
}) {
  const todayISO = useMemo(() => todayISODate(), []);
  const soonLimitISO = useMemo(() => toISODate(addDays(new Date(), 14)), []);

  const items = useMemo(() => {
    const raw = data?.items ?? [];
    const sorted = raw.slice().sort((a, b) => {
      const aStatus = statusForPayable(a, todayISO).key;
      const bStatus = statusForPayable(b, todayISO).key;
      const rank: Record<typeof aStatus, number> = { VENCIDO: 0, PROXIMO: 1, PAGADO: 2 };
      const diff = rank[aStatus] - rank[bStatus];
      if (diff !== 0) return diff;
      return a.dueDate.localeCompare(b.dueDate);
    });
    const max = size === "compact" ? 3 : size === "featured" ? 8 : 5;
    return sorted.slice(0, max);
  }, [data?.items, size, todayISO]);

  const soonTotal = useMemo(() => {
    const raw = data?.items ?? [];
    return raw.reduce((acc, item) => {
      if (item.paidAt) return acc;
      const dueISO = item.dueDate.slice(0, 10);
      if (dueISO <= soonLimitISO) return acc + Math.abs(item.amount);
      return acc;
    }, 0);
  }, [data?.items, soonLimitISO]);

  const rawItems = data?.items ?? [];

  if (error) {
    return (
      <SurfaceCard variant="soft" padding="sm">
        <p className="text-sm font-semibold text-slate-900">Cuotas próximas</p>
        <p className="mt-1 text-sm text-rose-700">{error}</p>
      </SurfaceCard>
    );
  }

  if (!loading && rawItems.length === 0) {
    return (
      <EmptyStateCard
        title="No tienes cuotas por pagar registradas"
        description="Registra compromisos en Pendientes y aparecerán aquí."
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
          <p className="mt-1 text-base font-semibold text-slate-900">Por pagar pronto</p>
          {size === "compact" ? null : (
            <p className="mt-1 text-sm text-slate-600">Vencidas y próximos 14 días.</p>
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

      <div className="rounded-2xl border border-slate-100 bg-white/80 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Total por pagar (pronto)
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {loading ? "..." : formatCurrency(soonTotal)}
        </p>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const badge = statusForPayable(item, todayISO);
          return (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-100 bg-white/80 px-3.5 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.origin}</p>
                  {size === "compact" ? null : (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {badge.key === "PAGADO" && item.paidAt
                        ? `Pagado: ${formatDate(item.paidAt)}`
                        : formatDate(item.dueDate)}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${badge.className}`}>
                  {badge.label}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                <span className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
                <span>{badge.key === "PAGADO" ? "Listo" : size === "compact" ? formatDate(item.dueDate) : "Pendiente"}</span>
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
