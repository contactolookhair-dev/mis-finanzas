"use client";

import { Shield } from "lucide-react";
import { ErrorStateCard } from "@/components/ui/states";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { FinancialHealthResponse } from "@/shared/types/financial-health";

export type FinancialHealthWidgetSize = "compact" | "standard" | "featured";

function statusBadge(status: FinancialHealthResponse["status"]) {
  switch (status) {
    case "saludable":
      return { label: "Saludable", className: "bg-emerald-50 text-emerald-700 ring-emerald-100" };
    case "atencion":
      return { label: "Atención", className: "bg-amber-50 text-amber-700 ring-amber-100" };
    case "critico":
      return { label: "Crítico", className: "bg-rose-50 text-rose-700 ring-rose-100" };
    default:
      return { label: "Estado", className: "bg-slate-50 text-slate-600 ring-slate-100" };
  }
}

export function FinancialHealthWidget({
  data,
  loading,
  error,
  size,
  onRetry
}: {
  data: FinancialHealthResponse | null;
  loading: boolean;
  error: string | null;
  size: FinancialHealthWidgetSize;
  onRetry?: () => void;
}) {
  if (error) {
    return <ErrorStateCard title="No se pudo cargar la salud financiera" description={error} onRetry={onRetry} />;
  }

  const status = data?.status ?? "atencion";
  const badge = statusBadge(status as FinancialHealthResponse["status"]);
  const score = data?.score ?? 0;
  const headline = data?.headline ?? "Salud financiera";
  const alert = data?.alerts?.[0]?.title ?? null;

  if (size === "compact") {
    return (
      <SurfaceCard variant="soft" padding="sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Salud financiera</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "…" : `${score}/100`}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        {alert ? <p className="mt-2 text-sm text-slate-600 line-clamp-2">{alert}</p> : null}
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard variant="soft" padding="sm" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-slate-500">
            <Shield className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Salud financiera</p>
          </div>
          <p className="mt-1 text-base font-semibold text-slate-900">{headline}</p>
          <p className="mt-1 text-sm text-slate-600">{data?.summary ?? "Resumen del período actual."}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white/80 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Puntaje</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? "..." : `${score}/100`}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white/80 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Foco</p>
          <p className="mt-2 text-sm font-semibold text-slate-900 line-clamp-2">
            {alert ?? data?.metrics.topExpenseCategory?.name ?? "Revisa tus gastos"}
          </p>
        </div>
      </div>
    </SurfaceCard>
  );
}

