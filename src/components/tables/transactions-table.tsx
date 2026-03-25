"use client";

import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyStateCard, ErrorStateCard, SkeletonCard } from "@/components/ui/states";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { getAccountIcon, getCategoryIcon } from "@/lib/ui/icon-maps";

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
          return (
            <Card key={transaction.id} className="premium-surface animate-fade-up p-4">
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
                    <span className="inline-flex items-center gap-1">
                      <AccountIcon className="h-3.5 w-3.5" />
                      {transaction.account}
                    </span>
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
            </Card>
          );
        })}
    </div>
  );
}
