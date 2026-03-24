"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { NewTransactionModal } from "@/components/movimientos/new-transaction-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import type { DashboardSnapshot } from "@/shared/types/dashboard";

type AccountItem = {
  id: string;
  balance: number;
};

type AccountsPayload = {
  items: AccountItem[];
};

type TransactionItem = {
  id: string;
  date: string;
  description: string;
  amount: number;
  account: string;
  category: string;
};

type TransactionsPayload = {
  items: TransactionItem[];
};

function buildMonthGrid(baseDate = new Date()) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstDayIndex = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDayIndex; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return { year, month, cells };
}

function keyByDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function InicioClient() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [accountsTotal, setAccountsTotal] = useState(0);
  const [movements, setMovements] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);

  const monthGrid = useMemo(() => buildMonthGrid(new Date()), []);
  const movementDateKeys = useMemo(
    () => new Set(movements.map((item) => item.date.slice(0, 10))),
    [movements]
  );

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const [dashboardResponse, accountsResponse, transactionsResponse] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/accounts", { cache: "no-store" }),
        fetch("/api/transactions?take=12", { cache: "no-store" })
      ]);

      if (!dashboardResponse.ok || !accountsResponse.ok || !transactionsResponse.ok) {
        throw new Error("No se pudo cargar la vista de inicio.");
      }

      const dashboardPayload = (await dashboardResponse.json()) as DashboardSnapshot;
      const accountsPayload = (await accountsResponse.json()) as AccountsPayload;
      const transactionsPayload = (await transactionsResponse.json()) as TransactionsPayload;

      setSnapshot(dashboardPayload);
      setAccountsTotal(
        (accountsPayload.items ?? []).reduce((acc, account) => acc + account.balance, 0)
      );
      setMovements(transactionsPayload.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error cargando inicio.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const incomes = Math.abs(snapshot?.kpis.incomes ?? 0);
  const expenses = Math.abs(snapshot?.kpis.expenses ?? 0);
  const flow = (snapshot?.kpis.netFlow ?? 0) + accountsTotal;

  const todayKey = keyByDate(new Date());

  return (
    <div className="space-y-4 pb-20 sm:space-y-5">
      <Card className="relative overflow-hidden rounded-[28px] border border-violet-100 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-emerald-500 p-5 text-white shadow-[0_28px_56px_rgba(124,58,237,0.32)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_40%)]" />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.2em] text-white/75">Saldo total</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight sm:text-[44px]">
            {loading ? "..." : formatCurrency(flow)}
          </p>
          <p className="mt-2 text-xs text-white/85">
            Disponible estimado entre cuentas y flujo del período.
          </p>
        </div>
      </Card>

      {error ? (
        <Card className="rounded-[20px] border border-rose-100 bg-rose-50/70 p-3 text-sm text-rose-700">
          {error}
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <Card className="rounded-[24px] border border-violet-100 bg-white p-4 shadow-soft">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Ingresos</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">
            {loading ? "..." : formatCurrency(incomes)}
          </p>
        </Card>
        <Card className="rounded-[24px] border border-fuchsia-100 bg-white p-4 shadow-soft">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Gastos</p>
          <p className="mt-2 text-2xl font-semibold text-fuchsia-600">
            {loading ? "..." : formatCurrency(expenses)}
          </p>
        </Card>
      </section>

      <Card className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Calendario mensual</h3>
          <span className="text-xs text-slate-500">
            {new Date(monthGrid.year, monthGrid.month, 1).toLocaleString("es-CL", { month: "long", year: "numeric" })}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400">
          {["L", "M", "M", "J", "V", "S", "D"].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {monthGrid.cells.map((day, index) => {
            if (!day) {
              return <span key={`empty-${index}`} className="h-9 rounded-xl bg-slate-50" />;
            }
            const dateKey = `${monthGrid.year}-${`${monthGrid.month + 1}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
            const isToday = dateKey === todayKey;
            const hasMovement = movementDateKeys.has(dateKey);
            return (
              <div
                key={dateKey}
                className={`flex h-9 items-center justify-center rounded-xl text-xs font-medium ${
                  isToday
                    ? "bg-violet-600 text-white"
                    : hasMovement
                      ? "bg-fuchsia-50 text-fuchsia-700"
                      : "bg-slate-50 text-slate-500"
                }`}
              >
                {day}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Movimientos recientes</h3>
          <span className="text-xs text-slate-500">{movements.length} registros</span>
        </div>
        <div className="space-y-2">
          {loading ? <p className="text-sm text-slate-500">Cargando movimientos...</p> : null}
          {!loading && movements.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay movimientos para este período.</p>
          ) : null}
          {movements.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{item.description}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(item.date)} · {item.account} · {item.category}
                </p>
              </div>
              <p className={`text-sm font-semibold ${item.amount >= 0 ? "text-emerald-600" : "text-fuchsia-600"}`}>
                {formatCurrency(item.amount)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <button
        type="button"
        onClick={() => setOpenModal(true)}
        className="fixed bottom-24 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-emerald-500 text-white shadow-[0_18px_32px_rgba(124,58,237,0.38)] transition hover:scale-[1.03]"
        aria-label="Nueva transacción"
      >
        <Plus className="h-6 w-6" />
      </button>

      <div className="hidden sm:block">
        <Button
          type="button"
          className="h-11 w-full rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-emerald-500 shadow-soft"
          onClick={() => setOpenModal(true)}
        >
          Nueva transacción
        </Button>
      </div>

      <NewTransactionModal
        open={openModal}
        onOpenChange={setOpenModal}
        onSuccess={() => {
          void loadData();
        }}
      />
    </div>
  );
}
