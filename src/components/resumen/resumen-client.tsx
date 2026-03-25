"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters/currency";
import type { DashboardSnapshot } from "@/shared/types/dashboard";

type DebtsTotals = {
  pendingTotal: number;
  collectedTotal: number;
};

type DebtsCommitments = {
  activeInstallmentDebts: number;
  monthlyCommittedTotal: number;
  upcomingCount: number;
  overdueCount: number;
  nextDueDate: string | null;
  nextDueDebtName: string | null;
};

export function ResumenClient() {
  const [spent, setSpent] = useState<number | null>(null);
  const [collected, setCollected] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [commitments, setCommitments] = useState<DebtsCommitments | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSummary() {
      try {
        setError(null);
        const [dashboardResponse, debtsResponse] = await Promise.all([
          fetch("/api/dashboard", { cache: "no-store" }),
          fetch("/api/debts", { cache: "no-store" })
        ]);

        if (!dashboardResponse.ok || !debtsResponse.ok) {
          throw new Error("No se pudo cargar el resumen.");
        }

        const dashboard = (await dashboardResponse.json()) as DashboardSnapshot;
        const debts = (await debtsResponse.json()) as {
          totals: DebtsTotals;
          commitments: DebtsCommitments;
        };

        setSpent(Math.abs(dashboard.kpis.expenses));
        setCollected(Math.abs(debts.totals.collectedTotal));
        setPending(Math.abs(debts.totals.pendingTotal));
        setCommitments(debts.commitments);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Error cargando resumen.");
      }
    }

    void loadSummary();
  }, []);

  return (
    <div className="space-y-4">
      {error ? (
        <Card className="rounded-[20px] border border-rose-100 bg-rose-50/70 p-4 text-sm text-rose-700">{error}</Card>
      ) : null}
      <Card className="rounded-[24px] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Resumen</p>
        <h2 className="mt-1 text-lg font-semibold">Vista rápida del negocio</h2>
      </Card>
      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-[24px] p-4">
          <p className="text-xs text-neutral-500">Gastado</p>
          <p className="mt-2 text-xl font-semibold">{spent === null ? "..." : formatCurrency(spent)}</p>
        </Card>
        <Card className="rounded-[24px] p-4">
          <p className="text-xs text-neutral-500">Cobrado</p>
          <p className="mt-2 text-xl font-semibold">{collected === null ? "..." : formatCurrency(collected)}</p>
        </Card>
        <Card className="rounded-[24px] p-4">
          <p className="text-xs text-neutral-500">Pendiente</p>
          <p className="mt-2 text-xl font-semibold">{pending === null ? "..." : formatCurrency(pending)}</p>
        </Card>
      </section>

      {commitments && commitments.activeInstallmentDebts > 0 ? (
        <section className="grid gap-3 lg:grid-cols-2">
          <Card className="rounded-[24px] border border-violet-100 bg-violet-50/50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-violet-500">
              Compromisos del mes
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatCurrency(commitments.monthlyCommittedTotal)}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {commitments.activeInstallmentDebts} deudas activas con cuotas pendientes.
            </p>
          </Card>
          <Card className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-neutral-500">Proximos</p>
                <p className="mt-2 text-xl font-semibold">{commitments.upcomingCount}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Vencidas</p>
                <p className="mt-2 text-xl font-semibold">{commitments.overdueCount}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Siguiente</p>
                <p className="mt-2 text-sm font-semibold">
                  {commitments.nextDueDate
                    ? new Date(commitments.nextDueDate).toLocaleDateString("es-CL")
                    : "Sin fecha"}
                </p>
                <p className="text-xs text-neutral-500">
                  {commitments.nextDueDebtName ?? "Sin deuda prioritaria"}
                </p>
              </div>
            </div>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
