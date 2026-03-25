"use client";

import { TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";

export type MonthFlowWidgetSize = "compact" | "standard" | "featured";

export function MonthFlowWidget({
  incomes,
  expenses,
  loading,
  size
}: {
  incomes: number;
  expenses: number;
  loading: boolean;
  size: MonthFlowWidgetSize;
}) {
  const net = incomes - expenses;

  if (size === "compact") {
    return (
      <SurfaceCard variant="soft" padding="sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Flujo del mes</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/70 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Ing.</p>
            <p className="mt-1 text-sm font-semibold text-emerald-600">{loading ? "…" : formatCurrency(incomes)}</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Gast.</p>
            <p className="mt-1 text-sm font-semibold text-rose-600">{loading ? "…" : formatCurrency(expenses)}</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Neto</p>
            <p className={`mt-1 text-sm font-semibold ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {loading ? "…" : formatCurrency(net)}
            </p>
          </div>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard variant="soft" padding="sm" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Flujo del mes</p>
          <p className="mt-1 text-base font-semibold text-slate-900">Ingresos vs gastos</p>
          <p className="mt-1 text-sm text-slate-600">Lectura rápida de tu resultado mensual.</p>
        </div>
        <div className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)]">
          {loading ? "…" : net >= 0 ? "Positivo" : "Negativo"}
        </div>
      </div>

      <div className={size === "featured" ? "grid gap-3 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}>
        <div className="rounded-2xl border border-slate-100 bg-white/80 p-3">
          <div className="flex items-center justify-between text-slate-500">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">Ingresos</p>
            <TrendingUp className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{loading ? "..." : formatCurrency(incomes)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white/80 p-3">
          <div className="flex items-center justify-between text-slate-500">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">Gastos</p>
            <TrendingDown className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-rose-600">{loading ? "..." : formatCurrency(expenses)}</p>
        </div>
        {size === "featured" ? (
          <div className="rounded-2xl border border-slate-100 bg-white/80 p-3">
            <div className="flex items-center justify-between text-slate-500">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">Neto</p>
              <Wallet className="h-4 w-4" />
            </div>
            <p className={`mt-2 text-2xl font-semibold ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {loading ? "..." : formatCurrency(net)}
            </p>
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

