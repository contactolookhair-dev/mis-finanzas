"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";

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
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="bg-muted/80 text-xs uppercase tracking-[0.18em] text-neutral-500">
            <tr>
              <th className="px-4 py-4">Fecha</th>
              <th className="px-4 py-4">Descripción</th>
              <th className="px-4 py-4">Cuenta</th>
              <th className="px-4 py-4">Categoría</th>
              <th className="px-4 py-4">Unidad</th>
              <th className="px-4 py-4">Origen</th>
              <th className="px-4 py-4">Monto</th>
              <th className="px-4 py-4">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="border-t border-border/80 text-sm">
                <td className="px-4 py-6 text-neutral-500" colSpan={8}>
                  Cargando movimientos reales...
                </td>
              </tr>
            ) : null}
            {!loading && error ? (
              <tr className="border-t border-border/80 text-sm">
                <td className="px-4 py-6 text-danger" colSpan={8}>
                  {error}
                </td>
              </tr>
            ) : null}
            {!loading && !error && rows.length === 0 ? (
              <tr className="border-t border-border/80 text-sm">
                <td className="px-4 py-6 text-neutral-500" colSpan={8}>
                  No hay movimientos para mostrar en este workspace.
                </td>
              </tr>
            ) : null}
            {rows.map((transaction) => (
              <tr key={transaction.id} className="border-t border-border/80 text-sm">
                <td className="px-4 py-4">{formatDate(transaction.date)}</td>
                <td className="px-4 py-4">
                  <div className="space-y-1">
                    <p className="font-medium">{transaction.description}</p>
                    {transaction.reimbursable ? (
                      <p className="text-xs text-warning">Reembolsable por negocio</p>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-4 text-neutral-500">{transaction.account}</td>
                <td className="px-4 py-4">{transaction.category}</td>
                <td className="px-4 py-4">{transaction.businessUnit}</td>
                <td className="px-4 py-4">
                  {transaction.origin === "PERSONAL" ? "Personal" : "Empresa"}
                </td>
                <td
                  className={`px-4 py-4 font-semibold ${
                    transaction.amount > 0 ? "text-success" : "text-foreground"
                  }`}
                >
                  {formatCurrency(transaction.amount)}
                </td>
                <td className="px-4 py-4">
                  <Badge tone={getTone(transaction.reviewStatus) as "warning" | "success" | "neutral"}>
                    {transaction.reviewStatus === "PENDIENTE"
                      ? "Pendiente"
                      : transaction.reviewStatus === "REVISADO"
                        ? "Revisado"
                        : "Observado"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
