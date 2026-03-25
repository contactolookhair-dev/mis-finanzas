"use client";

import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters/currency";
import type { DashboardFilters, DashboardSnapshot } from "@/shared/types/dashboard";
import type { FinancialHealthResponse } from "@/shared/types/financial-health";
import { getFinancialLevel, getGreeting } from "@/components/dashboard/dashboard-gamification";

export function DashboardHero({
  snapshot,
  filters,
  displayBalance,
  financialHealth,
  onMonthlyReport,
  monthlyReportLoading,
  onRefresh,
  loading
}: {
  snapshot: DashboardSnapshot;
  filters: DashboardFilters;
  displayBalance: number;
  financialHealth: FinancialHealthResponse | null;
  onMonthlyReport: () => void;
  monthlyReportLoading: boolean;
  onRefresh: () => void;
  loading: boolean;
}) {
  const netFlowComparison = snapshot.comparisons.netFlow;
  const TrendIcon = netFlowComparison.delta > 0 ? TrendingUp : netFlowComparison.delta < 0 ? TrendingDown : Sparkles;
  const level = getFinancialLevel(financialHealth);
  const greeting = getGreeting();

  const deltaTone =
    netFlowComparison.delta > 0
      ? "bg-emerald-50/90 text-emerald-700"
      : netFlowComparison.delta < 0
        ? "bg-rose-50/90 text-rose-700"
        : "bg-slate-100/90 text-slate-700";

  return (
    <Card className="relative overflow-hidden rounded-[34px] border border-white/65 bg-gradient-to-br from-white/85 via-cyan-50/70 to-emerald-50/70 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.14)] sm:p-6">
      <div className="pointer-events-none absolute -left-10 -top-12 h-44 w-44 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-6 h-52 w-52 rounded-full bg-emerald-300/20 blur-3xl" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
              {greeting} · Tu dinero hoy
            </p>
            <span className="inline-flex items-center rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              Nivel {level.current.label}
            </span>
          </div>

          <p className="text-number-glow text-[2.6rem] font-semibold leading-none tracking-[-0.04em] text-slate-950 sm:text-[3.25rem]">
            {formatCurrency(displayBalance)}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${deltaTone}`}>
              <TrendIcon className="h-3.5 w-3.5" />
              {netFlowComparison.deltaPct >= 0 ? "+" : ""}
              {netFlowComparison.deltaPct.toFixed(1)}% vs mes anterior
            </span>
            <span className="text-[11px] text-slate-500 sm:text-xs">
              {netFlowComparison.delta >= 0 ? "+" : ""}
              {formatCurrency(netFlowComparison.delta)}
            </span>
          </div>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Siguiente nivel: {level.current.nextLabel ?? "Max"}</span>
              <span>{level.score}/100</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-400 transition-[width] duration-700 ease-out"
                style={{ width: `${Math.round(level.progressPct * 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-600">{level.current.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-9 rounded-full px-4 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(15,23,42,0.12)]"
            onClick={onMonthlyReport}
            disabled={monthlyReportLoading}
          >
            {monthlyReportLoading ? "Generando PDF..." : "Reporte mensual PDF"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 rounded-full px-4 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(15,23,42,0.12)]"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>
      </div>

      <p className="relative mt-4 text-[11px] text-slate-600">
        {snapshot.comparisons.currentPeriodLabel} · {snapshot.kpis.totalTransactions} movimientos · Filtros activos listos
      </p>
    </Card>
  );
}
