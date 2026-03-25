"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { LineChartCard } from "@/components/charts/chart-card";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardQuickActions } from "@/components/dashboard/dashboard-quick-actions";
import { FinancialHealthCenter } from "@/components/health/financial-health-center";
import { InsightList } from "@/components/dashboard/insight-list";
import { StatCard } from "@/components/dashboard/stat-card";
import { Building, CreditCard, ShieldCheck, Wallet } from "lucide-react";
import { ExportActions } from "@/components/exports/export-actions";
import { NewTransactionModal } from "@/components/movimientos/new-transaction-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyStateCard, ErrorStateCard, SkeletonCard } from "@/components/ui/states";
import {
  appendMonthlyReportHistory,
  createMonthlyReportHistoryEntry,
  downloadMonthlyReportPdf
} from "@/shared/lib/monthly-report";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import type { DashboardFilters, DashboardSnapshot } from "@/shared/types/dashboard";
import type { FinancialHealthResponse } from "@/shared/types/financial-health";

function getDefaultRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 29);

  const format = (value: Date) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, "0");
    const day = `${value.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return {
    startDate: format(start),
    endDate: format(end)
  };
}

type AccountItem = {
  id: string;
  name: string;
  type: string;
  balance: number;
};

const accountTypeMap: Record<
  string,
  { label: string; gradient: string; icon: typeof Wallet; accent: string; secondary: string }
> = {
  EFECTIVO: {
    label: "Billetera",
    gradient: "from-amber-50 via-amber-100 to-white/90",
    icon: Wallet,
    accent: "text-amber-700",
    secondary: "Saldo disponible"
  },
  DEBITO: {
    label: "Cuenta débito",
    gradient: "from-white via-slate-50 to-slate-100",
    icon: Building,
    accent: "text-slate-900",
    secondary: "Saldo actual"
  },
  CREDITO: {
    label: "Tarjeta crédito",
    gradient: "from-slate-900 via-slate-800 to-slate-900",
    icon: CreditCard,
    accent: "text-white",
    secondary: "Cupo disponible"
  },
  OTRO: {
    label: "Cuenta digital",
    gradient: "from-sky-50 via-white/90 to-slate-50",
    icon: ShieldCheck,
    accent: "text-sky-700",
    secondary: "Disponible"
  }
};

function AccountCard({ account }: { account: AccountItem }) {
  const meta = accountTypeMap[account.type] ?? accountTypeMap.OTRO;
  const Icon = meta.icon;

  return (
    <div className="relative rounded-[30px] border border-white/80 bg-white/90 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.12)] transition hover:-translate-y-1">
      <div className="absolute inset-0 rounded-[30px] bg-gradient-to-br opacity-50" style={{ background: meta.gradient }} />
      <div className="relative space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.4em] ${meta.accent}`}>
              {meta.label}
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">{account.name}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.1)]">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">{meta.secondary}</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{formatCurrency(account.balance)}</p>
        </div>
        {account.type === "CREDITO" ? (
          <div className="space-y-2 rounded-[20px] bg-slate-900/80 p-3 text-white">
            <div className="flex items-center justify-between text-xs">
              <span>Utilizado</span>
              <span>{formatCurrency(account.balance * 0.18)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/30">
              <div className="h-full bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-400" style={{ width: "40%" }} />
            </div>
            <p className="text-[11px] text-white/80">Cupo 40% usado</p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Saldo manual</p>
        )}
      </div>
    </div>
  );
}

function AccountList({
  accounts,
  loading
}: {
  accounts: AccountItem[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className="h-32 animate-pulse rounded-[28px] border border-dashed border-slate-200 bg-white/70"
          />
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return <EmptyStateCard title="Aun no tienes cuentas" description="Crea tu primera cartera para ver tu dinero distribuido." actionLabel="Crear cuenta" onAction={() => (window.location.href = "/cuentas")} />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <AccountCard key={account.id} account={account} />
      ))}
    </div>
  );
}

function FilterChip({
  label,
  value,
  onClear
}: {
  label: string;
  value: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1.5 text-[11px] font-medium text-neutral-600 transition-colors hover:bg-white"
    >
      <span className="text-neutral-400">{label}</span>
      <span className="text-neutral-800">{value}</span>
    </button>
  );
}

function getFilterLabel(filters: DashboardFilters, snapshot: DashboardSnapshot | null) {
  const chips: Array<{ key: keyof DashboardFilters | "period"; label: string; value: string }> = [];

  if (filters.startDate && filters.endDate) {
    chips.push({
      key: "period",
      label: "Periodo",
      value: `${filters.startDate} → ${filters.endDate}`
    });
  }

  if (filters.businessUnitId) {
    const unit = snapshot?.references.businessUnits.find((item) => item.id === filters.businessUnitId);
    chips.push({
      key: "businessUnitId",
      label: "Unidad",
      value: unit?.name ?? "Seleccionada"
    });
  }

  if (filters.categoryId) {
    const category = snapshot?.references.categories.find((item) => item.id === filters.categoryId);
    chips.push({
      key: "categoryId",
      label: "Categoría",
      value: category?.name ?? "Seleccionada"
    });
  }

  if (filters.financialOrigin) {
    chips.push({
      key: "financialOrigin",
      label: "Origen",
      value: filters.financialOrigin === "PERSONAL" ? "Personal" : "Empresa"
    });
  }

  if (filters.reviewStatus) {
    chips.push({
      key: "reviewStatus",
      label: "Revisión",
      value: filters.reviewStatus
    });
  }

  return chips;
}

function FiltersRow({
  filters,
  onChange,
  onReset,
  snapshot
}: {
  filters: DashboardFilters;
  onChange: (patch: Partial<DashboardFilters>) => void;
  onReset: () => void;
  snapshot: DashboardSnapshot | null;
}) {
  const chips = getFilterLabel(filters, snapshot);

  return (
    <Card className="space-y-4 rounded-[28px] border border-white/70 bg-white/78 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] sm:p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Filtros</p>
      </div>
      <div className="grid gap-2.5 lg:grid-cols-3">
        <Input
          type="date"
          value={filters.startDate ?? ""}
          onChange={(event) => onChange({ startDate: event.target.value || undefined })}
          className="bg-white/80"
        />
        <Input
          type="date"
          value={filters.endDate ?? ""}
          onChange={(event) => onChange({ endDate: event.target.value || undefined })}
          className="bg-white/80"
        />
        <Select
          value={filters.businessUnitId ?? ""}
          onChange={(event) => onChange({ businessUnitId: event.target.value || undefined })}
        >
          <option value="">Todas las unidades</option>
          {snapshot?.references.businessUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-2.5 lg:grid-cols-3">
        <Select
          value={filters.financialOrigin ?? ""}
          onChange={(event) =>
            onChange({
              financialOrigin: (event.target.value || undefined) as "PERSONAL" | "EMPRESA" | undefined
            })
          }
        >
          <option value="">Personal + empresa</option>
          <option value="PERSONAL">Solo personal</option>
          <option value="EMPRESA">Solo empresa</option>
        </Select>
        <Select
          value={filters.reviewStatus ?? ""}
          onChange={(event) =>
            onChange({
              reviewStatus: (event.target.value || undefined) as
                | "PENDIENTE"
                | "REVISADO"
                | "OBSERVADO"
                | undefined
            })
          }
        >
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="REVISADO">Revisado</option>
          <option value="OBSERVADO">Observado</option>
        </Select>
        <Select
          value={filters.categoryId ?? ""}
          onChange={(event) => onChange({ categoryId: event.target.value || undefined })}
        >
          <option value="">Todas las categorias</option>
          {snapshot?.references.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Button variant="ghost" className="px-3 py-1.5 text-xs font-semibold" onClick={onReset}>
          Restablecer filtros
        </Button>
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <FilterChip
              key={`${chip.key}-${chip.value}`}
              label={chip.label}
              value={chip.value}
              onClear={() =>
                chip.key === "period"
                  ? onChange({ startDate: undefined, endDate: undefined })
                  : onChange({ [chip.key]: undefined } as Partial<DashboardFilters>)
              }
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

function GoalsCard({
  snapshot,
  financialHealth
}: {
  snapshot: DashboardSnapshot;
  financialHealth: FinancialHealthResponse | null;
}) {
  const incomes = snapshot.kpis.incomes;
  const savings = financialHealth?.metrics.savings ?? snapshot.kpis.netFlow;
  const target = Math.max(50_000, Math.round(incomes * 0.1));
  const pct = target > 0 ? Math.max(0, Math.min(1, savings / target)) : 0;

  const headline =
    savings >= target ? "Meta cumplida" : savings > 0 ? "Vas en buen camino" : "Primero estabiliza tu flujo";

  return (
    <Card className="rounded-[28px] border border-white/75 bg-white/88 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.07)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Progreso</p>
          <h3 className="mt-1 text-base font-semibold text-slate-900 sm:text-lg">{headline}</h3>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Meta del mes: ahorrar {formatCurrency(target)} (10% de ingresos aprox.)
          </p>
        </div>
        <div className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.15)]">
          {Math.round(pct * 100)}%
        </div>
      </div>
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-400 transition-[width] duration-700 ease-out"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>Ahorro actual: {formatCurrency(savings)}</span>
        <span>Restante: {formatCurrency(Math.max(0, target - savings))}</span>
      </div>
    </Card>
  );
}

function SummaryGrid({ kpis, snapshot }: { kpis: DashboardSnapshot["kpis"]; snapshot: DashboardSnapshot }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Ingresos"
        value={kpis.incomes}
        detail={`${kpis.totalTransactions} movimientos`}
        accent="emerald"
        comparison={{ ...snapshot.comparisons.incomes, previousLabel: "período anterior" }}
      />
      <StatCard
        label="Egresos"
        value={kpis.expenses}
        detail="Gasto real del período"
        accent="sand"
        comparison={{
          ...snapshot.comparisons.expenses,
          previousLabel: "período anterior",
          invertTrend: true
        }}
      />
      <StatCard
        label="Flujo neto"
        value={kpis.netFlow}
        detail="Resultado actual"
        accent={kpis.netFlow >= 0 ? "emerald" : "sand"}
        comparison={{ ...snapshot.comparisons.netFlow, previousLabel: "período anterior" }}
      />
      <StatCard
        label="Por cobrar"
        value={kpis.receivables}
        detail="Saldo pendiente de clientes"
        accent="ink"
        comparison={{ ...snapshot.comparisons.receivables, previousLabel: "corte anterior" }}
      />
    </section>
  );
}

function RecentTransactionsList({ items }: { items: DashboardSnapshot["recentTransactions"] }) {
  return (
    <Card className="space-y-4 rounded-[28px] border border-white/75 bg-white/88 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.07)] sm:p-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Movimientos recientes</h3>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">Lo último registrado en tu flujo filtrado.</p>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <EmptyStateCard
            title="Sin movimientos en este rango"
            description="Registra un gasto o ajusta filtros para ver actividad."
            actionLabel="Agregar gasto"
            onAction={() => {
              const button = document.querySelector<HTMLButtonElement>('button[aria-label="Nueva transacción"]');
              button?.click();
            }}
            className="shadow-none"
          />
        ) : null}
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-[24px] border border-white/75 bg-white/78 px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_26px_rgba(15,23,42,0.08)]"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.description}</p>
                <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
                  {formatDate(item.date)} · {item.category} · {item.businessUnit}
                </p>
              </div>
              <p
                className={`text-sm font-semibold ${
                  item.type === "INGRESO" ? "text-emerald-600" : "text-slate-900"
                }`}
              >
                {formatCurrency(item.amount)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ComparisonSummary({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <Card className="space-y-4 rounded-[28px] border border-white/75 bg-white/86 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.07)] sm:p-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Lectura comparativa</h3>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          {snapshot.comparisons.currentPeriodLabel} frente a {snapshot.comparisons.previousPeriodLabel}
        </p>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {snapshot.comparisons.chart.map((item) => (
          <div key={item.key} className="rounded-[20px] border border-white/70 bg-white/70 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-neutral-600">{item.label}</p>
                <p className="mt-1 text-base font-semibold text-neutral-900">{formatCurrency(item.current)}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  item.delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                }`}
              >
                {item.deltaPct >= 0 ? "+" : ""}
                {item.deltaPct.toFixed(1)}%
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-500">
              Anterior: {formatCurrency(item.previous)} · Variación: {item.delta >= 0 ? "+" : ""}
              {formatCurrency(item.delta)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function DashboardClient() {
  const router = useRouter();
  const [filters, setFilters] = useState<DashboardFilters | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [financialHealth, setFinancialHealth] = useState<FinancialHealthResponse | null>(null);
  const [financialHealthLoading, setFinancialHealthLoading] = useState(false);
  const [financialHealthError, setFinancialHealthError] = useState<string | null>(null);
  const [monthlyReportLoading, setMonthlyReportLoading] = useState(false);
  const [monthlyReportError, setMonthlyReportError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const initializedRef = useRef(false);
  const skipNextFilteredFetchRef = useRef(false);

  function openQuickTransaction(kind: "GASTO" | "INGRESO") {
    try {
      window.localStorage.setItem("mis-finanzas.quick-transaction", JSON.stringify({ kind }));
    } catch {
      // no-op
    }
    setTransactionModalOpen(true);
  }

  const queryString = useMemo(() => {
    if (!filters) return "";
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    return params.toString();
  }, [filters]);

  async function loadFinancialHealth(inputFilters: DashboardFilters | null) {
    if (!inputFilters) return;

    try {
      setFinancialHealthLoading(true);
      setFinancialHealthError(null);

      const params = new URLSearchParams();
      Object.entries(inputFilters).forEach(([key, value]) => {
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

  async function handleMonthlyReportExport() {
    const activeFilters = filters ?? getDefaultRange();

    try {
      setMonthlyReportLoading(true);
      setMonthlyReportError(null);
      const { fileName } = await downloadMonthlyReportPdf(activeFilters);
      appendMonthlyReportHistory(
        createMonthlyReportHistoryEntry({
          periodLabel: snapshot?.comparisons.currentPeriodLabel ?? "Período mensual",
          filters: activeFilters,
          fileName
        })
      );
    } catch (exportError) {
      setMonthlyReportError(
        exportError instanceof Error ? exportError.message : "Error exportando reporte mensual."
      );
    } finally {
      setMonthlyReportLoading(false);
    }
  }

  useEffect(() => {
    async function loadInitialDashboard() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/dashboard", {
          method: "GET",
          cache: "no-store"
        });
        const payload = (await response.json()) as DashboardSnapshot & { message?: string };
        if (!response.ok) {
          throw new Error(payload.message ?? "No se pudo cargar el dashboard.");
        }
        skipNextFilteredFetchRef.current = true;
        setSnapshot(payload);
        setFilters(payload.filters);
        initializedRef.current = true;
        void loadFinancialHealth(payload.filters);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Error cargando dashboard.");
      } finally {
        setLoading(false);
      }
    }

    void loadInitialDashboard();
  }, []);

  useEffect(() => {
    if (!initializedRef.current || !filters) return;
    if (skipNextFilteredFetchRef.current) {
      skipNextFilteredFetchRef.current = false;
      return;
    }

    async function loadDashboardWithFilters() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/dashboard?${queryString}`, {
          method: "GET",
          cache: "no-store"
        });
        const payload = (await response.json()) as DashboardSnapshot & { message?: string };
        if (!response.ok) {
          throw new Error(payload.message ?? "No se pudo cargar el dashboard.");
        }
        setSnapshot(payload);
        void loadFinancialHealth(payload.filters);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Error cargando dashboard.");
      } finally {
        setLoading(false);
      }
    }

    void loadDashboardWithFilters();
  }, [queryString, refreshKey, filters]);

  useEffect(() => {
    let aborted = false;

    async function loadAccounts() {
      try {
        setAccountsLoading(true);
        const response = await fetch("/api/accounts", { cache: "no-store" });
        if (!response.ok) throw new Error("No se pudieron cargar las cuentas.");
        const payload = (await response.json()) as { items: AccountItem[] };
        if (!aborted) setAccounts(payload.items ?? []);
      } catch {
        if (!aborted) setAccounts([]);
      } finally {
        if (!aborted) setAccountsLoading(false);
      }
    }

    void loadAccounts();
    return () => {
      aborted = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!initializedRef.current || !filters) return;

    const timeout = window.setTimeout(() => {
      void fetch("/api/dashboard/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ filters })
      }).catch(() => undefined);
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [filters]);

  const kpis = snapshot?.kpis;
  const accountsTotal = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts]
  );

  return (
    <div className="space-y-5 pb-24 sm:space-y-6 sm:pb-20">
      {error ? (
        <ErrorStateCard
          title="No se pudo cargar el dashboard"
          details={error}
          onRetry={() => window.location.reload()}
        />
      ) : null}

      {loading && !snapshot ? (
        <SkeletonCard lines={4} />
      ) : null}

      {snapshot && kpis ? (
        <>
          <DashboardHero
            snapshot={snapshot}
            filters={filters ?? getDefaultRange()}
            displayBalance={accountsTotal}
            financialHealth={financialHealth}
            onMonthlyReport={handleMonthlyReportExport}
            monthlyReportLoading={monthlyReportLoading}
            onRefresh={() => setRefreshKey((value) => value + 1)}
            loading={loading}
          />

          {monthlyReportError ? (
            <Card className="rounded-[20px] border border-rose-100 bg-rose-50/70 p-3 text-sm text-rose-700">
              {monthlyReportError}
            </Card>
          ) : null}

          <DashboardQuickActions
            onExpense={() => openQuickTransaction("GASTO")}
            onIncome={() => openQuickTransaction("INGRESO")}
            onDebt={() => router.push("/pendientes")}
            onReports={handleMonthlyReportExport}
          />

          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                Resumen financiero
              </p>
              <h2 className="text-lg font-semibold text-slate-900">Lo importante del mes</h2>
            </div>
            <SummaryGrid kpis={kpis} snapshot={snapshot} />
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                Salud financiera
              </p>
              <h2 className="text-lg font-semibold text-slate-900">Tu semáforo y foco</h2>
            </div>
            <FinancialHealthCenter data={financialHealth} loading={financialHealthLoading} />
            {financialHealthError ? (
              <Card className="rounded-[20px] border border-rose-100 bg-rose-50/70 p-3 text-sm text-rose-700">
                {financialHealthError}
              </Card>
            ) : null}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  Tus cuentas
                </p>
                <h2 className="text-lg font-semibold text-slate-900">Dónde está tu dinero</h2>
              </div>
              <p className="text-sm font-semibold text-slate-500">{accounts.length} cuentas</p>
            </div>
            <AccountList accounts={accounts} loading={accountsLoading} />
          </section>

          <GoalsCard snapshot={snapshot} financialHealth={financialHealth} />

          <section className="grid gap-3.5 lg:grid-cols-[1.45fr_0.55fr] lg:gap-4">
            <LineChartCard
              title="Tendencia mensual"
              description="6 meses para seguir ingresos, egresos y flujo neto."
              data={snapshot.charts.trend}
            />
            <ComparisonSummary snapshot={snapshot} />
          </section>

          <RecentTransactionsList items={snapshot.recentTransactions} />

          <section className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Reportes</p>
              <h2 className="text-lg font-semibold text-slate-900">Exporta cuando lo necesites</h2>
            </div>
            <ExportActions filters={filters ?? getDefaultRange()} defaultReportType="dashboard_summary" />
          </section>

          <section className="space-y-4">
            <InsightList insights={snapshot.insights} />
          </section>

          <FiltersRow
            filters={filters ?? getDefaultRange()}
            onChange={(patch) => setFilters((current) => ({ ...(current ?? {}), ...patch }))}
            onReset={() => setFilters(getDefaultRange())}
            snapshot={snapshot}
          />
        </>
      ) : null}

      <Button
        variant="secondary"
        onClick={() => openQuickTransaction("GASTO")}
        className="glass-surface fixed bottom-4 right-4 z-30 flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 text-sm font-semibold text-white ring-1 ring-white/25 transition-all duration-200 hover:brightness-105 active:scale-[0.985] sm:hidden"
      >
        Agregar gasto
      </Button>

      <NewTransactionModal
        open={transactionModalOpen}
        onOpenChange={setTransactionModalOpen}
        onSuccess={() => setRefreshKey((value) => value + 1)}
      />
    </div>
  );
}
