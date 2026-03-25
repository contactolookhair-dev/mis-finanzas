"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Wallet2 } from "lucide-react";
import { NewTransactionModal } from "@/components/movimientos/new-transaction-modal";
import { FinancialHealthCenter } from "@/components/health/financial-health-center";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";
import { Button } from "@/components/ui/button";
import { EmptyStateCard, ErrorStateCard, Skeleton } from "@/components/ui/states";
import { MobileStickyAction } from "@/components/ui/mobile-sticky-action";
import { SectionHeader } from "@/components/ui/section-header";
import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import type { DashboardSnapshot } from "@/shared/types/dashboard";
import type { FinancialHealthResponse } from "@/shared/types/financial-health";
import type { FinancialInsightsResponse } from "@/shared/types/financial-insights";
import { FinancialInsightsPanel } from "@/components/inicio/financial-insights-panel";

const accountCardGradient = "linear-gradient(135deg,#2563eb,#06b6d4,#10b981)";
const heroGradient = "from-sky-600 via-cyan-600 to-emerald-500";

type AccountItem = {
  id: string;
  balance: number;
  name: string;
  bank: string;
  type: "CREDITO" | "DEBITO" | "EFECTIVO";
  color: string | null;
  icon: string | null;
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
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const todayKey = keyByDate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [calculatorInput, setCalculatorInput] = useState("");
  const [calculatorResult, setCalculatorResult] = useState<number | null>(null);
  const [financialInsights, setFinancialInsights] = useState<FinancialInsightsResponse | null>(null);
  const [financialInsightsLoading, setFinancialInsightsLoading] = useState(false);
  const [financialInsightsError, setFinancialInsightsError] = useState<string | null>(null);
  const [financialHealth, setFinancialHealth] = useState<FinancialHealthResponse | null>(null);
  const [financialHealthLoading, setFinancialHealthLoading] = useState(false);
  const [financialHealthError, setFinancialHealthError] = useState<string | null>(null);

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
      setAccounts(accountsPayload.items ?? []);
      setMovements(transactionsPayload.items ?? []);
      void loadFinancialHealth(dashboardPayload.filters);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error cargando inicio.");
    } finally {
      setLoading(false);
    }
  }

  async function loadFinancialHealth(filters: DashboardSnapshot["filters"]) {
    try {
      setFinancialHealthLoading(true);
      setFinancialHealthError(null);

      const params = new URLSearchParams();
      Object.entries(filters ?? {}).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        }
      });

      const response = await fetch(
        `/api/health/financial${params.toString() ? `?${params.toString()}` : ""}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "No se pudo cargar la salud financiera.");
      }

      const payload = (await response.json()) as FinancialHealthResponse;
      setFinancialHealth(payload);
    } catch (loadError) {
      setFinancialHealthError(
        loadError instanceof Error ? loadError.message : "No se pudo cargar la salud financiera."
      );
    } finally {
      setFinancialHealthLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const incomes = Math.abs(snapshot?.kpis.incomes ?? 0);
  const expenses = Math.abs(snapshot?.kpis.expenses ?? 0);
  const flow = (snapshot?.kpis.netFlow ?? 0) + accountsTotal;

  const selectedDayAmount = useMemo(() => {
    const dailyMovements = movements.filter((item) => item.date.startsWith(selectedDate));
    return dailyMovements.reduce((sum, item) => sum + item.amount, 0);
  }, [movements, selectedDate]);
  const selectedDayTotal = accountsTotal + selectedDayAmount;
  const selectedDateLabel = useMemo(() => {
    const parsed = new Date(selectedDate);
    return parsed.toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }, [selectedDate]);
  const onboardingInsightReady = Boolean(snapshot && accounts.length > 0 && movements.length > 0);

  const appendCalculatorSymbol = (symbol: string) => {
    setCalculatorInput((prev) => `${prev}${symbol}`);
  };

  const evaluateExpression = (value: string) => {
    if (!value.trim()) return null;
    const sanitized = value.replace(/[^0-9.+\-*/() ]/g, "");
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${sanitized}`)();
      return typeof result === "number" && Number.isFinite(result) ? result : null;
    } catch (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error
    ) {
      return null;
    }
  };

  const handleCalculatorEquals = () => {
    const result = evaluateExpression(calculatorInput);
    setCalculatorResult(result);
  };

  const handleCalculatorClear = () => {
    setCalculatorInput("");
    setCalculatorResult(null);
  };

  const handleCalculatorDelete = () => {
    setCalculatorInput((prev) => prev.slice(0, -1));
  };

  async function handleAnalyzeFinancials() {
    try {
      setFinancialInsightsLoading(true);
      setFinancialInsightsError(null);

      const response = await fetch("/api/ai/financial-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          filters: snapshot?.filters ?? undefined
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "No se pudo generar el análisis.");
      }

      const payload = (await response.json()) as FinancialInsightsResponse;
      setFinancialInsights(payload);
    } catch (submitError) {
      setFinancialInsightsError(
        submitError instanceof Error ? submitError.message : "No se pudo generar el análisis."
      );
    } finally {
      setFinancialInsightsLoading(false);
    }
  }

  return (
    <div className="space-y-5 pb-20 sm:space-y-6">
      <SectionHeader
        eyebrow="Inicio"
        title="Tu dinero en un vistazo"
        description="Cuentas, calendario, movimientos y analisis en una sola vista clara y mobile-first."
        actions={
          <StatPill tone="premium" icon={<Wallet2 className="h-3.5 w-3.5" />}>
            Vista diaria
          </StatPill>
        }
      />

      <OnboardingBanner
        accountsCount={accounts.length}
        movementsCount={movements.length}
        insightsReady={onboardingInsightReady}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.length === 0 ? (
          <EmptyStateCard
            title="Aún no tienes cuentas"
            description="Crea tu primera billetera o tarjeta para registrar movimientos."
            actionLabel="Crear cuenta"
            onAction={() => (window.location.href = "/cuentas")}
          />
        ) : null}
        {accounts.map((account) => (
          <SurfaceCard
            key={account.id}
            variant="soft"
            className="bg-gradient-to-br from-white/80 to-white/30"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {account.bank}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{account.name}</p>
              </div>
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow"
                style={{
                  background: account.color ? account.color : accountCardGradient
                }}
              >
                {account.icon ?? "💳"}
              </span>
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">Saldo disponible</p>
            <p className="text-2xl font-semibold text-slate-900">{formatCurrency(account.balance)}</p>
          </SurfaceCard>
        ))}
      </section>
      <SurfaceCard className={`relative overflow-hidden bg-gradient-to-br ${heroGradient} text-white shadow-[0_28px_56px_rgba(37,99,235,0.24)]`}>
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
      </SurfaceCard>

      <FinancialHealthCenter data={financialHealth} loading={financialHealthLoading} />
      {financialHealthError ? (
        <ErrorStateCard
          title="No se pudo cargar la salud financiera"
          description={financialHealthError}
          onRetry={() => void loadData()}
        />
      ) : null}

      <SurfaceCard variant="highlight" padding="sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Análisis inteligente</p>
            <p className="text-base font-semibold text-slate-900">Pulsa para revisar tu situación financiera con IA</p>
          </div>
          <Button
            type="button"
            onClick={handleAnalyzeFinancials}
            disabled={financialInsightsLoading}
            className="h-11 rounded-2xl bg-gradient-to-r from-sky-600 via-cyan-600 to-emerald-500 px-4 text-sm font-semibold shadow-[0_16px_32px_rgba(37,99,235,0.22)]"
          >
            {financialInsightsLoading ? "Analizando..." : "Analizar mis finanzas"}
          </Button>
        </div>
      </SurfaceCard>

      {error ? (
        <ErrorStateCard title="No se pudo cargar la vista" description={error} onRetry={() => void loadData()} />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <SurfaceCard variant="soft" padding="sm" className="border-sky-100">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Ingresos</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">
            {loading ? "..." : formatCurrency(incomes)}
          </p>
        </SurfaceCard>
        <SurfaceCard variant="soft" padding="sm" className="border-cyan-100">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Gastos</p>
          <p className="mt-2 text-2xl font-semibold text-sky-600">
            {loading ? "..." : formatCurrency(expenses)}
          </p>
        </SurfaceCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <SurfaceCard variant="soft" padding="sm">
          <div className="mb-2 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Calendario mensual</p>
              <p className="text-lg font-semibold text-slate-900">
                {new Date(monthGrid.year, monthGrid.month, 1).toLocaleString("es-CL", {
                  month: "long",
                  year: "numeric"
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Saldo del día</p>
              <p className="text-lg font-semibold text-emerald-600">{formatCurrency(selectedDayTotal)}</p>
              <p className="text-[11px] text-slate-400">{selectedDateLabel}</p>
            </div>
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
              const isSelected = dateKey === selectedDate;
              const hasMovement = movementDateKeys.has(dateKey);
              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedDate(dateKey)}
                  className={`flex h-9 items-center justify-center rounded-xl text-xs font-medium transition ${
                    isSelected
                      ? "bg-emerald-600/90 text-white"
                      : isToday
                        ? "bg-sky-600 text-white"
                        : hasMovement
                          ? "bg-sky-50 text-sky-700"
                          : "bg-slate-50 text-slate-500"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </SurfaceCard>
        <SurfaceCard variant="soft" padding="sm">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Calculadora dinámica</p>
            <p className="text-lg font-semibold text-slate-900">Haz cuentas sin salir del dashboard</p>
          </div>
          <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-right text-2xl font-semibold text-slate-900">
            {calculatorInput || "0"}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Resultado: {calculatorResult !== null ? calculatorResult.toLocaleString("es-CL", { maximumFractionDigits: 2 }) : "-"}
          </p>
          <div className="mt-4 grid grid-cols-4 gap-2 text-sm">
            {[
              "7",
              "8",
              "9",
              "/",
              "4",
              "5",
              "6",
              "*",
              "1",
              "2",
              "3",
              "-",
              "0",
              ".",
              "⌫",
              "+"
            ].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === "⌫") {
                    handleCalculatorDelete();
                    return;
                  }
                  appendCalculatorSymbol(key);
                }}
                className="rounded-2xl border border-slate-200 bg-white/60 py-3 font-semibold text-slate-900 transition hover:scale-[1.01]"
              >
                {key}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleCalculatorClear}
              className="flex-1 rounded-2xl border border-rose-200 bg-rose-50/70 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={handleCalculatorEquals}
              className="flex-1 rounded-2xl border border-emerald-300 bg-emerald-50/70 py-3 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-100"
            >
              =
            </button>
          </div>
        </SurfaceCard>
      </section>

      <SurfaceCard variant="soft" padding="sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Movimientos recientes</h3>
          <span className="text-xs text-slate-500">{movements.length} registros</span>
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
          {!loading && movements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Sin movimientos</p>
              <p className="mt-1 text-sm text-slate-500">Agrega tu primer gasto o ingreso para ver el historial aquí.</p>
              <Button type="button" variant="secondary" className="mt-3 rounded-full" onClick={() => setOpenModal(true)}>
                Agregar movimiento
              </Button>
            </div>
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
      </SurfaceCard>

      <FinancialInsightsPanel
        loading={financialInsightsLoading}
        error={financialInsightsError}
        response={financialInsights}
      />

      <MobileStickyAction type="button" onClick={() => setOpenModal(true)} aria-label="Nueva transacción">
        <Plus className="mr-2 h-5 w-5" />
        Nueva transacción
      </MobileStickyAction>

      <div className="hidden sm:block">
        <Button
          type="button"
          className="h-11 w-full rounded-2xl bg-gradient-to-r from-sky-600 via-cyan-600 to-emerald-500 shadow-soft"
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
