"use client";

import { EmptyStateCard, Skeleton } from "@/components/ui/states";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";

export type RecentMovementItem = {
  id: string;
  date: string;
  description: string;
  amount: number;
  account: string;
  category: string;
};

export type RecentMovementsWidgetSize = "compact" | "standard" | "featured";

export function RecentMovementsWidget({
  items,
  loading,
  size,
  onCreate
}: {
  items: RecentMovementItem[];
  loading: boolean;
  size: RecentMovementsWidgetSize;
  onCreate?: () => void;
}) {
  const max = size === "compact" ? 3 : size === "featured" ? 10 : 6;
  const visible = items.slice(0, max);

  return (
    <SurfaceCard variant="soft" padding="sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Movimientos recientes</h3>
        <span className="text-xs text-slate-500">{items.length} registros</span>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>
        ) : null}

        {!loading && visible.length === 0 ? (
          <EmptyStateCard
            title="Sin movimientos"
            description="Agrega tu primer gasto o ingreso para ver el historial aquí."
            actionLabel={onCreate ? "Agregar movimiento" : undefined}
            onAction={onCreate}
            className="shadow-none"
          />
        ) : null}

        {visible.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/70 px-3.5 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04)]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{item.description}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatDate(item.date)} · {item.account} · {item.category}
              </p>
            </div>
            <p className={`shrink-0 text-sm font-semibold ${item.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {formatCurrency(item.amount)}
            </p>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

