"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { EmptyStateCard } from "@/components/ui/states";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";

export type DebtsSnapshot = {
  people: Array<{
    id: string;
    name: string;
    reason: string;
    pendingAmount: number;
    isInstallmentDebt: boolean;
    installmentValue: number;
    nextInstallmentDate: string | null;
    installmentStatus: "AL_DIA" | "PROXIMA" | "VENCIDA" | "PAGADA";
    installmentStatusLabel: string;
  }>;
  totals: {
    pendingPeople: number;
  };
  commitments: {
    activeInstallmentDebts: number;
    monthlyCommittedTotal: number;
    upcomingCount: number;
    overdueCount: number;
    nextDueDate: string | null;
    nextDueDebtName: string | null;
    upcomingTimeline: Array<{
      debtId: string;
      debtName: string;
      reason: string;
      dueDate: string;
      amount: number;
      health: "AL_DIA" | "PROXIMA" | "VENCIDA" | "PAGADA";
      daysUntilDue: number;
    }>;
  };
};

export type DebtorsWidgetSize = "compact" | "standard" | "featured";

function statusTone(status: DebtsSnapshot["people"][number]["installmentStatus"]) {
  switch (status) {
    case "AL_DIA":
    case "PAGADA":
      return { label: "Al día", className: "bg-emerald-50 text-emerald-700 ring-emerald-100" };
    case "PROXIMA":
      return { label: "Próxima cuota", className: "bg-amber-50 text-amber-700 ring-amber-100" };
    case "VENCIDA":
      return { label: "Atrasado", className: "bg-rose-50 text-rose-700 ring-rose-100" };
    default:
      return { label: "Pendiente", className: "bg-slate-50 text-slate-600 ring-slate-100" };
  }
}

function priorityRank(status: DebtsSnapshot["people"][number]["installmentStatus"]) {
  switch (status) {
    case "VENCIDA":
      return 0;
    case "PROXIMA":
      return 1;
    case "AL_DIA":
      return 2;
    case "PAGADA":
      return 3;
    default:
      return 9;
  }
}

export function DebtorsWidget({
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
  const pendingPeople = data?.totals.pendingPeople ?? 0;
  const monthlyDue = data?.commitments.monthlyCommittedTotal ?? 0;

  const items = useMemo(() => {
    const people = (data?.people ?? [])
      .filter((item) => item.pendingAmount > 0)
      .slice()
      .sort((left, right) => {
        const rank = priorityRank(left.installmentStatus) - priorityRank(right.installmentStatus);
        if (rank !== 0) return rank;
        return right.pendingAmount - left.pendingAmount;
      });

    const max =
      size === "compact" ? 3 : size === "featured" ? 8 : 5;
    return people.slice(0, max);
  }, [data, size]);

  if (error) {
    return (
      <SurfaceCard variant="soft" padding="sm">
        <p className="text-sm font-semibold text-slate-900">Mis deudores</p>
        <p className="mt-1 text-sm text-rose-700">{error}</p>
      </SurfaceCard>
    );
  }

  if (!loading && pendingPeople <= 0) {
    return (
      <EmptyStateCard
        title="No tienes cobros pendientes registrados"
        description="Registra una deuda para ver aquí quién te debe y cuánto queda por cobrar."
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Personas que me deben
          </p>
          <p className="mt-1 text-base font-semibold text-slate-900">Mis deudores</p>
          <p className="mt-1 text-sm text-slate-600">
            Cobros pendientes y estado de cuotas.
          </p>
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

      <div className={size === "compact" ? "grid gap-2" : "grid gap-3 sm:grid-cols-2"}>
        <div className="rounded-2xl border border-slate-100 bg-white/80 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Por cobrar este mes
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {loading ? "..." : formatCurrency(monthlyDue)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white/80 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Deuda total pendiente
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {loading ? "..." : formatCurrency(pendingPeople)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const tone = statusTone(item.installmentStatus);
          const monthlyLabel = item.isInstallmentDebt ? "Este mes" : "Pendiente";
          const monthlyAmount = item.isInstallmentDebt ? item.installmentValue : item.pendingAmount;

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-100 bg-white/80 px-3.5 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{item.reason}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${tone.className}`}>
                  {tone.label}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {monthlyLabel}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(monthlyAmount)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Total pendiente
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(item.pendingAmount)}</p>
                </div>
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
