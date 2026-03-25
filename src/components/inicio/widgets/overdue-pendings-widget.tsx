"use client";

import { useMemo } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { EmptyStateCard } from "@/components/ui/states";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import type { DebtsSnapshot } from "@/components/inicio/widgets/debtors-widget";
import type { PayablesSnapshot } from "@/components/inicio/widgets/upcoming-payables-widget";

type WidgetSize = "compact" | "standard" | "featured";

function todayISODate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function OverduePendingsWidget({
  debts,
  debtsLoading,
  debtsError,
  payables,
  payablesLoading,
  payablesError,
  size,
  onViewAll
}: {
  debts: DebtsSnapshot | null;
  debtsLoading: boolean;
  debtsError: string | null;
  payables: PayablesSnapshot | null;
  payablesLoading: boolean;
  payablesError: string | null;
  size: WidgetSize;
  onViewAll?: () => void;
}) {
  const todayISO = useMemo(() => todayISODate(), []);

  const overdueReceivables = useMemo(() => {
    const timeline = debts?.commitments.upcomingTimeline ?? [];
    const items = timeline.filter((item) => item.health === "VENCIDA");
    const amount = items.reduce((acc, item) => acc + Math.abs(item.amount), 0);
    return { count: items.length, amount, items };
  }, [debts?.commitments.upcomingTimeline]);

  const overduePayables = useMemo(() => {
    const items = (payables?.items ?? []).filter((item) => {
      if (item.paidAt) return false;
      const dueISO = item.dueDate.slice(0, 10);
      return dueISO < todayISO;
    });
    const amount = items.reduce((acc, item) => acc + Math.abs(item.amount), 0);
    return { count: items.length, amount, items };
  }, [payables?.items, todayISO]);

  const totalOverdueCount = overdueReceivables.count + overduePayables.count;
  const totalOverdueAmount = overdueReceivables.amount + overduePayables.amount;

  const listItems = useMemo(() => {
    const merged: Array<
      | { kind: "me-deben"; id: string; title: string; date: string; amount: number }
      | { kind: "debo-pagar"; id: string; title: string; date: string; amount: number }
    > = [];
    overdueReceivables.items.forEach((item) => {
      merged.push({
        kind: "me-deben",
        id: `r_${item.debtId}`,
        title: item.debtName,
        date: item.dueDate,
        amount: item.amount
      });
    });
    overduePayables.items.forEach((item) => {
      merged.push({
        kind: "debo-pagar",
        id: `p_${item.id}`,
        title: item.origin,
        date: item.dueDate,
        amount: item.amount
      });
    });
    merged.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const max = size === "compact" ? 2 : size === "featured" ? 8 : 4;
    return merged.slice(0, max);
  }, [overduePayables.items, overdueReceivables.items, size]);

  const isLoading = debtsLoading || payablesLoading;
  const error = debtsError || payablesError;

  if (error) {
    return (
      <SurfaceCard variant="soft" padding="sm">
        <p className="text-sm font-semibold text-slate-900">Vencidos</p>
        <p className="mt-1 text-sm text-rose-700">{error}</p>
      </SurfaceCard>
    );
  }

  if (!isLoading && totalOverdueCount === 0) {
    return (
      <EmptyStateCard
        title="No tienes pendientes vencidos"
        description="Cuando algo se atrase, aparecerá aquí para que lo veas al entrar."
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
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Vencidos</p>
          </div>
          <p className="mt-1 text-base font-semibold text-slate-900">Lo atrasado primero</p>
          {size === "compact" ? null : (
            <p className="mt-1 text-sm text-slate-600">Pendientes vencidos por cobrar y por pagar.</p>
          )}
        </div>
        {onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="tap-feedback inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Ver todo
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className={size === "compact" ? "grid gap-2" : "grid gap-3 sm:grid-cols-3"}>
        <div className="rounded-2xl border border-slate-100 bg-white/80 p-3 sm:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Total vencido
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-rose-600">
            {isLoading ? "..." : formatCurrency(totalOverdueAmount)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white/80 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Items</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{isLoading ? "…" : totalOverdueCount}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
              Me deben: {overdueReceivables.count}
            </span>
            <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
              Debo pagar: {overduePayables.count}
            </span>
          </div>
        </div>
      </div>

      {size === "compact" ? null : (
        <div className="space-y-2">
          {listItems.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-100 bg-white/80 px-3.5 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.kind === "me-deben" ? "Me deben" : "Debo pagar"} · {formatDate(item.date)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-rose-600">{formatCurrency(item.amount)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}
