"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Layers3 } from "lucide-react";
import { SurfaceCard } from "@/components/ui/surface-card";
import { SkeletonCard, EmptyStateCard, ErrorStateCard } from "@/components/ui/states";
import { formatCurrency } from "@/lib/formatters/currency";
import type { WidgetSize } from "@/components/inicio/widgets/dashboard-widget-registry";
import type { CategoryMonthlyAnalyticsResponse } from "@/shared/types/category-analytics";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getSpotlightTag(categoryName: string) {
  const n = normalizeText(categoryName);
  if (!n) return null;
  if (n.includes("comida") || n.includes("restaurant") || n.includes("delivery")) return "comida";
  if (n.includes("transporte") || n.includes("uber") || n.includes("cabify")) return "transporte";
  if (n.includes("software") || n.includes("apps") || n.includes("suscripcion") || n.includes("suscripciones"))
    return "software/apps";
  if (n.includes("publicidad") || n.includes("marketing") || n.includes("ads")) return "publicidad/marketing";
  if (n.includes("combustible") || n.includes("bencina") || n.includes("copec")) return "combustible";
  if (n.includes("suscripciones") || n.includes("suscripcion")) return "suscripciones";
  return null;
}

function formatDelta(value: number) {
  const abs = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatCurrency(abs)}`;
}

export function CategoryBreakdownWidget({ size }: { size: WidgetSize }) {
  const [data, setData] = useState<CategoryMonthlyAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/analytics/categories", { cache: "no-store" });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(payload.message ?? "No se pudo cargar el análisis por categorías.");
        }
        const payload = (await response.json()) as CategoryMonthlyAnalyticsResponse;
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar el análisis por categorías.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const max = useMemo(() => {
    if (!data?.items?.length) return 0;
    return Math.max(...data.items.map((i) => i.total));
  }, [data?.items]);

  if (loading) {
    return (
      <SurfaceCard variant="soft" padding="sm" className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-slate-700" />
          <p className="text-sm font-semibold text-slate-900">Categorías del mes</p>
        </div>
        <SkeletonCard lines={4} />
      </SurfaceCard>
    );
  }

  if (error) {
    return <ErrorStateCard title="No se pudo cargar categorías" description={error} />;
  }

  if (!data || data.items.length === 0) {
    return (
      <EmptyStateCard
        title="Sin gasto por categorías"
        description="Cuando registres movimientos con categoría, verás aquí tus top del mes y su variación."
      />
    );
  }

  return (
    <SurfaceCard variant="soft" padding="sm" className={`space-y-4 ${size === "featured" ? "lg:p-5" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-slate-700" />
            <p className="text-sm font-semibold text-slate-900">Categorías del mes</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {data.month} vs {data.previousMonth} · Total {formatCurrency(data.totalExpenses)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {data.items.map((item) => {
          const pct = max > 0 ? (item.total / max) * 100 : 0;
          const deltaTone =
            item.delta > 0 ? "text-rose-700 border-rose-200 bg-rose-50" : item.delta < 0 ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-slate-600 border-slate-200 bg-slate-50";
          const tag = getSpotlightTag(item.categoryName);

          return (
            <div key={item.categoryId ?? item.categoryName} className="rounded-[22px] border border-slate-100 bg-white/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {item.categoryName}
                    {tag ? (
                      <span className="ml-2 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                        {tag}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.percentage.toFixed(1)}% del gasto · {item.count} mov.
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.total)}</p>
                  <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${deltaTone}`}>
                    {item.delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : item.delta < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : null}
                    {formatDelta(item.delta)} · {Math.round(item.deltaPct)}%
                  </span>
                </div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-slate-900 via-slate-700 to-emerald-500"
                  style={{ width: `${Math.max(2, Math.min(pct, 100))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}

