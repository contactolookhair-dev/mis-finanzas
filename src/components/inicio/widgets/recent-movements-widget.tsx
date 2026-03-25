"use client";

import { EmptyStateCard, Skeleton } from "@/components/ui/states";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { resolveAccountAppearance } from "@/lib/accounts/account-appearance";

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
  onCreate,
  accounts
}: {
  items: RecentMovementItem[];
  loading: boolean;
  size: RecentMovementsWidgetSize;
  onCreate?: () => void;
  accounts?: Array<{
    id: string;
    name: string;
    bank: string;
    type: "CREDITO" | "DEBITO" | "EFECTIVO";
    balance: number;
    color: string | null;
    icon: string | null;
    appearanceMode: "auto" | "manual";
  }>;
}) {
  const max = size === "compact" ? 3 : size === "featured" ? 10 : 6;
  const visible = items.slice(0, max);
  const accountByName = new Map(
    (accounts ?? []).map((account) => [account.name.trim().toLowerCase(), account])
  );

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
          (() => {
            const account = accountByName.get(item.account.trim().toLowerCase()) ?? null;
            const appearance = account ? resolveAccountAppearance(account) : null;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/70 px-3.5 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{item.description}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDate(item.date)} ·{" "}
                    {appearance ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-2 py-0.5 font-semibold text-slate-700"
                        style={{ borderColor: appearance.accentColor }}
                      >
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded-full text-[10px]"
                          style={{
                            color: appearance.accentColor,
                            backgroundColor: appearance.accentBackground
                          }}
                        >
                          {appearance.glyph}
                        </span>
                        {item.account}
                      </span>
                    ) : (
                      item.account
                    )}{" "}
                    · {item.category}
                  </p>
                </div>
                <p className={`shrink-0 text-sm font-semibold ${item.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatCurrency(item.amount)}
                </p>
              </div>
            );
          })()
        ))}
      </div>
    </SurfaceCard>
  );
}
