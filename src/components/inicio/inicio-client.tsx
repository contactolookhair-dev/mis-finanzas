"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDownToLine, CircleDollarSign, HandCoins, WalletCards } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters/currency";
import { cn } from "@/lib/utils";
import type { DashboardSnapshot } from "@/shared/types/dashboard";

type InicioMetrics = {
  spentToday: number;
  spentMonth: number;
  receivablesPending: number;
};

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function InicioClient() {
  const [metrics, setMetrics] = useState<InicioMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      try {
        setLoading(true);
        setError(null);

        const today = formatDateInput(new Date());
        const monthStart = formatDateInput(getMonthStart());

        const [todayResponse, monthResponse, baseResponse] = await Promise.all([
          fetch(`/api/dashboard?startDate=${today}&endDate=${today}`, { cache: "no-store" }),
          fetch(`/api/dashboard?startDate=${monthStart}&endDate=${today}`, { cache: "no-store" }),
          fetch("/api/dashboard", { cache: "no-store" })
        ]);

        if (!todayResponse.ok || !monthResponse.ok || !baseResponse.ok) {
          throw new Error("No se pudieron cargar las métricas de inicio.");
        }

        const todaySnapshot = (await todayResponse.json()) as DashboardSnapshot;
        const monthSnapshot = (await monthResponse.json()) as DashboardSnapshot;
        const baseSnapshot = (await baseResponse.json()) as DashboardSnapshot;

        setMetrics({
          spentToday: Math.abs(todaySnapshot.kpis.expenses),
          spentMonth: Math.abs(monthSnapshot.kpis.expenses),
          receivablesPending: Math.abs(baseSnapshot.kpis.receivables)
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Error cargando inicio.");
      } finally {
        setLoading(false);
      }
    }

    void loadMetrics();
  }, []);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/gastos#agregar-gasto"
          className={cn(buttonVariants({ variant: "default" }), "h-auto justify-start rounded-[24px] px-4 py-4 text-left")}
        >
          <ArrowDownToLine className="mt-0.5 h-5 w-5" />
          <div>
            <p className="text-sm font-semibold">Agregar gasto</p>
            <p className="text-xs text-white/90">Registrar movimiento del día</p>
          </div>
        </Link>
        <Link
          href="/deudas?tab=personas&action=nueva"
          className={cn(buttonVariants({ variant: "secondary" }), "h-auto justify-start rounded-[24px] px-4 py-4 text-left")}
        >
          <HandCoins className="mt-0.5 h-5 w-5" />
          <div>
            <p className="text-sm font-semibold">Registrar deuda</p>
            <p className="text-xs text-neutral-600">Nueva cuenta por cobrar</p>
          </div>
        </Link>
        <Link
          href="/deudas?tab=personas&action=abono"
          className={cn(buttonVariants({ variant: "secondary" }), "h-auto justify-start rounded-[24px] px-4 py-4 text-left")}
        >
          <CircleDollarSign className="mt-0.5 h-5 w-5" />
          <div>
            <p className="text-sm font-semibold">Registrar abono</p>
            <p className="text-xs text-neutral-600">Actualizar deuda pendiente</p>
          </div>
        </Link>
        <Link
          href="/deudas"
          className={cn(buttonVariants({ variant: "secondary" }), "h-auto justify-start rounded-[24px] px-4 py-4 text-left")}
        >
          <WalletCards className="mt-0.5 h-5 w-5" />
          <div>
            <p className="text-sm font-semibold">Ver saldo pendiente</p>
            <p className="text-xs text-neutral-600">Empresas + personas</p>
          </div>
        </Link>
      </section>

      {error ? (
        <Card className="rounded-[24px] border border-rose-100 bg-rose-50/60 p-4 text-sm text-rose-700">
          {error}
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-[24px] p-4">
          <p className="text-xs text-neutral-500">Gastado hoy</p>
          <p className="mt-2 text-xl font-semibold">
            {loading || !metrics ? "..." : formatCurrency(metrics.spentToday)}
          </p>
        </Card>
        <Card className="rounded-[24px] p-4">
          <p className="text-xs text-neutral-500">Gastado este mes</p>
          <p className="mt-2 text-xl font-semibold">
            {loading || !metrics ? "..." : formatCurrency(metrics.spentMonth)}
          </p>
        </Card>
        <Card className="rounded-[24px] p-4">
          <p className="text-xs text-neutral-500">Total pendiente por cobrar</p>
          <p className="mt-2 text-xl font-semibold">
            {loading || !metrics ? "..." : formatCurrency(metrics.receivablesPending)}
          </p>
        </Card>
      </section>
    </div>
  );
}
