"use client";

import { useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyStateCard, ErrorStateCard, SkeletonCard } from "@/components/ui/states";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { getAccountIcon, getCategoryIcon } from "@/lib/ui/icon-maps";
import { resolveAccountAppearance } from "@/lib/accounts/account-appearance";

type TransactionRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "INGRESO" | "EGRESO";
  account: string;
  category: string;
  businessUnit: string;
  origin: "PERSONAL" | "EMPRESA";
  reimbursable: boolean;
  reviewStatus: "PENDIENTE" | "REVISADO" | "OBSERVADO";
  isInstallmentPurchase?: boolean;
  cuotaActual?: number | null;
  cuotaTotal?: number | null;
};

type TransactionsPayload = {
  items: TransactionRow[];
};

function getTone(status: string) {
  if (status === "REVISADO") return "success";
  if (status === "PENDIENTE") return "warning";
  return "neutral";
}

export function TransactionsTable() {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<
    {
      id: string;
      name: string;
      bank: string;
      type: "CREDITO" | "DEBITO" | "EFECTIVO";
      balance: number;
      color: string | null;
      icon: string | null;
      appearanceMode: "auto" | "manual";
    }[]
  >([]);

  useEffect(() => {
    async function loadTransactions() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/transactions?take=60", {
          method: "GET",
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error("No se pudieron cargar los movimientos.");
        }

        const payload = (await response.json()) as TransactionsPayload;
        setRows(payload.items);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Error cargando movimientos.");
      } finally {
        setLoading(false);
      }
    }

    void loadTransactions();
  }, []);

  useEffect(() => {
    async function loadAccounts() {
      try {
        const response = await fetch("/api/accounts", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          items: {
            id: string;
            name: string;
            bank: string;
            type: "CREDITO" | "DEBITO" | "EFECTIVO";
            balance: number;
            color: string | null;
            icon: string | null;
            appearanceMode: "auto" | "manual";
          }[];
        };
        setAccounts(payload.items ?? []);
      } catch {
        setAccounts([]);
      }
    }

    void loadAccounts();
  }, []);

  const accountByName = useMemo(
    () => new Map(accounts.map((account) => [account.name.trim().toLowerCase(), account])),
    [accounts]
  );

  return (
    <div className="space-y-2">
      {loading ? <SkeletonCard lines={4} /> : null}
      {!loading && error ? (
        <ErrorStateCard
          title="No se pudieron cargar los movimientos"
          details={error}
          onRetry={() => window.location.reload()}
        />
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyStateCard
          icon={Receipt}
          title="Aun no hay movimientos"
          description="Registra tu primer gasto o ingreso para ver actividad aqui."
          actionLabel="Agregar movimiento"
          onAction={() => {
            const anchor = document.getElementById("agregar-gasto");
            anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      ) : null}

      {!loading &&
        !error &&
        rows.map((transaction) => {
          const CategoryIcon = getCategoryIcon(transaction.category);
          const AccountIcon = getAccountIcon(transaction.account);
          const matchedAccount = accountByName.get(transaction.account.trim().toLowerCase()) ?? null;
          const appearance = matchedAccount ? resolveAccountAppearance(matchedAccount) : null;
          const installmentLabel =
            transaction.isInstallmentPurchase === true
              ? typeof transaction.cuotaActual === "number" && typeof transaction.cuotaTotal === "number"
                ? `Cuota ${transaction.cuotaActual}/${transaction.cuotaTotal}`
                : "En cuotas"
              : null;
          return (
            <SurfaceCard
              key={transaction.id}
              variant="soft"
              padding="sm"
              className="animate-fade-up"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {transaction.description}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <CategoryIcon className="h-3.5 w-3.5" />
                      {transaction.category}
                    </span>
                    {installmentLabel ? (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/90 px-2 py-0.5 font-semibold text-slate-700">
                        {installmentLabel}
                      </span>
                    ) : null}
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
                        {transaction.account}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <AccountIcon className="h-3.5 w-3.5" />
                        {transaction.account}
                      </span>
                    )}
                    <span>{formatDate(transaction.date)}</span>
                  </div>
                  {transaction.reimbursable ? (
                    <p className="mt-1 text-xs text-amber-600">Reembolsable por negocio</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p
                    className={`text-base font-semibold ${
                      transaction.amount > 0 ? "text-emerald-600" : "text-fuchsia-600"
                    }`}
                  >
                    {formatCurrency(transaction.amount)}
                  </p>
                  <div className="mt-1">
                    <Badge tone={getTone(transaction.reviewStatus) as "warning" | "success" | "neutral"}>
                      {transaction.reviewStatus === "PENDIENTE"
                        ? "Pendiente"
                        : transaction.reviewStatus === "REVISADO"
                          ? "Revisado"
                          : "Observado"}
                    </Badge>
                  </div>
                </div>
              </div>
            </SurfaceCard>
          );
        })}
    </div>
  );
}
