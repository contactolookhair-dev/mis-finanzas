"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCcw, Sparkles } from "lucide-react";
import { LineChartCard } from "@/components/charts/chart-card";
import { InsightList } from "@/components/dashboard/insight-list";
import { StatCard } from "@/components/dashboard/stat-card";
import { ExportActions } from "@/components/exports/export-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import type { DashboardFilters, DashboardSnapshot } from "@/shared/types/dashboard";

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

function HeroPanel({
  kpis,
  snapshot,
  filters,
  onRefresh,
  loading
}: {
  kpis: DashboardSnapshot["kpis"];
  snapshot: DashboardSnapshot;
  filters: DashboardFilters;
  onRefresh: () => void;
  loading: boolean;
}) {
  const neutralGain = kpis.netFlow >= 0;
  return (
    <Card className="rounded-[32px] border border-white/65 bg-gradient-to-br from-slate-50/92 via-white/94 to-slate-100/80 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.1)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-slate-400">
            Dinero disponible hoy
          </p>
          <p className="mt-2 text-[2.1rem] font-semibold leading-none tracking-[-0.03em] text-slate-950 sm:text-[2.7rem]">
            {formatCurrency(kpis.netFlow)}
          </p>
          <p className="mt-2 text-xs text-slate-500 sm:text-sm">
            {snapshot.comparisons.currentPeriodLabel} · {kpis.totalTransactions} movimientos
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportActions
            filters={filters}
            defaultReportType="dashboard_summary"
            compact
          />
          <Button variant="secondary" size="sm" className="h-9 px-3 text-xs" onClick={onRefresh} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        <div className="rounded-[24px] border border-white/70 bg-white/72 px-3.5 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Ingresos</p>
          <p className="mt-1 text-lg font-semibold text-emerald-700">{formatCurrency(kpis.incomes)}</p>
          <p className="text-[11px] text-slate-500">{snapshot.comparisons.incomes.deltaPct >= 0 ? "+" : ""}
            {snapshot.comparisons.incomes.deltaPct.toFixed(1)}%</p>
        </div>
        <div className="rounded-[24px] border border-white/70 bg-white/72 px-3.5 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Egresos</p>
          <p className="mt-1 text-lg font-semibold text-rose-600">{formatCurrency(kpis.expenses)}</p>
          <p className="text-[11px] text-slate-500">{snapshot.comparisons.expenses.deltaPct >= 0 ? "+" : ""}
            {snapshot.comparisons.expenses.deltaPct.toFixed(1)}%</p>
        </div>
        <div className="rounded-[24px] border border-white/70 bg-white/72 px-3.5 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Dinero personal en empresa</p>
          <p className="mt-1 text-lg font-semibold text-teal-700">
            {formatCurrency(kpis.personalMoneyInBusiness)}
          </p>
          <p className="text-[11px] text-slate-500">
            {snapshot.comparisons.personalMoneyInBusiness.deltaPct >= 0 ? "+" : ""}
            {snapshot.comparisons.personalMoneyInBusiness.deltaPct.toFixed(1)}%
          </p>
        </div>
      </div>
      <p className="mt-4 text-[11px] text-slate-500">
        {neutralGain ? "Flujo positivo, sigue así." : "Hay presión de caja, revisa los egresos."}
      </p>
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
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-600">No hay movimientos en este rango</p>
            <p className="mt-1 text-xs text-slate-500">Cambia filtros o importa nuevos datos para ver actividad.</p>
          </div>
        ) : null}
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-[24px] border border-white/75 bg-white/78 px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-colors hover:bg-white"
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
  const [filters, setFilters] = useState<DashboardFilters | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const initializedRef = useRef(false);
  const skipNextFilteredFetchRef = useRef(false);

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
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Error cargando dashboard.");
      } finally {
        setLoading(false);
      }
    }

    void loadDashboardWithFilters();
  }, [queryString, refreshKey, filters]);

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

  return (
    <div className="space-y-5 pb-24 sm:space-y-6 sm:pb-20">
      {error ? (
        <Card className="rounded-[28px] border border-rose-100 bg-rose-50/80 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <p className="text-sm text-danger">{error}</p>
        </Card>
      ) : null}

      {loading && !snapshot ? (
        <Card className="rounded-[28px] border border-white/70 bg-white/84 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <div className="space-y-3">
            <div className="h-3 w-32 animate-pulse rounded-full bg-slate-200/80" />
            <div className="h-9 w-44 animate-pulse rounded-xl bg-slate-200/70" />
            <div className="h-3 w-56 animate-pulse rounded-full bg-slate-200/70" />
          </div>
        </Card>
      ) : null}

      {snapshot && kpis ? (
        <>
          <section className="space-y-3.5 sm:space-y-4">
          <HeroPanel
            kpis={kpis}
            snapshot={snapshot}
            filters={filters ?? getDefaultRange()}
            onRefresh={() => setRefreshKey((value) => value + 1)}
            loading={loading}
          />
            <FiltersRow
              filters={filters ?? getDefaultRange()}
              onChange={(patch) => setFilters((current) => ({ ...(current ?? {}), ...patch }))}
              onReset={() => setFilters(getDefaultRange())}
              snapshot={snapshot}
            />
          </section>

          <SummaryGrid kpis={kpis} snapshot={snapshot} />

          <section className="grid gap-3.5 lg:grid-cols-[1.45fr_0.55fr] lg:gap-4">
            <LineChartCard
              title="Tendencia mensual"
              description="6 meses para seguir ingresos, egresos y flujo neto."
              data={snapshot.charts.trend}
            />
            <ComparisonSummary snapshot={snapshot} />
          </section>

          <section className="space-y-4">
            <InsightList insights={snapshot.insights} />
          </section>

          <RecentTransactionsList items={snapshot.recentTransactions} />
        </>
      ) : null}

      <Button
        variant="secondary"
        className="fixed bottom-4 right-4 z-30 flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold shadow-[0_14px_38px_rgba(15,23,42,0.26)] sm:hidden"
      >
        Agregar gasto
      </Button>
    </div>
  );
}
