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
      className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/85 px-3 py-2 text-xs font-medium text-neutral-600 transition hover:bg-white"
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
    <Card className="space-y-4 rounded-[28px] border border-white/80 bg-white/80 shadow-[0_20px_45px_rgba(15,23,42,0.08)] p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">Filtros</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
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
      <div className="grid gap-3 lg:grid-cols-3">
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="px-4 py-2 text-sm font-semibold" onClick={onReset}>
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
    <Card className="rounded-[32px] border border-white/70 bg-gradient-to-br from-slate-50/90 to-white/90 p-6 shadow-[0_35px_70px_rgba(15,23,42,0.12)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">
            Dinero disponible hoy
          </p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
            {formatCurrency(kpis.netFlow)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {snapshot.comparisons.currentPeriodLabel} · {kpis.totalTransactions} movimientos
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportActions
            filters={filters}
            defaultReportType="dashboard_summary"
            compact
          />
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[26px] border border-white/60 bg-white/80 px-4 py-3 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Ingresos</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">{formatCurrency(kpis.incomes)}</p>
          <p className="text-xs text-slate-500">{snapshot.comparisons.incomes.deltaPct >= 0 ? "+" : ""}
            {snapshot.comparisons.incomes.deltaPct.toFixed(1)}%</p>
        </div>
        <div className="rounded-[26px] border border-white/60 bg-white/80 px-4 py-3 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Egresos</p>
          <p className="mt-1 text-xl font-semibold text-rose-600">{formatCurrency(kpis.expenses)}</p>
          <p className="text-xs text-slate-500">{snapshot.comparisons.expenses.deltaPct >= 0 ? "+" : ""}
            {snapshot.comparisons.expenses.deltaPct.toFixed(1)}%</p>
        </div>
        <div className="rounded-[26px] border border-white/60 bg-white/80 px-4 py-3 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Dinero personal en empresa</p>
          <p className="mt-1 text-xl font-semibold text-teal-700">
            {formatCurrency(kpis.personalMoneyInBusiness)}
          </p>
          <p className="text-xs text-slate-500">
            {snapshot.comparisons.personalMoneyInBusiness.deltaPct >= 0 ? "+" : ""}
            {snapshot.comparisons.personalMoneyInBusiness.deltaPct.toFixed(1)}%
          </p>
        </div>
      </div>
      <p className="mt-5 text-xs text-slate-500">
        {neutralGain ? "Flujo positivo, sigue así." : "Hay presión de caja, revisa los egresos."}
      </p>
    </Card>
  );
}

function SummaryGrid({ kpis, snapshot }: { kpis: DashboardSnapshot["kpis"]; snapshot: DashboardSnapshot }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
    <Card className="space-y-4 rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_30px_60px_rgba(15,23,42,0.08)]">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Movimientos recientes</h3>
        <p className="mt-1 text-sm text-slate-500">Lo último registrado en tu flujo filtrado.</p>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay movimientos en este rango.</p>
        ) : null}
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-[26px] border border-white/80 bg-white/80 px-4 py-3 shadow-[0_20px_45px_rgba(15,23,42,0.05)]"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{item.description}</p>
                <p className="text-xs text-slate-500">
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
    <Card className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Lectura comparativa</h3>
        <p className="mt-1 text-sm text-neutral-500">
          {snapshot.comparisons.currentPeriodLabel} frente a {snapshot.comparisons.previousPeriodLabel}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {snapshot.comparisons.chart.map((item) => (
          <div key={item.key} className="rounded-[22px] border border-white/80 bg-white/75 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-neutral-700">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-neutral-900">{formatCurrency(item.current)}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  item.delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                }`}
              >
                {item.deltaPct >= 0 ? "+" : ""}
                {item.deltaPct.toFixed(1)}%
              </span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
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
    <div className="space-y-6 pb-20">
      {error ? (
        <Card className="rounded-[28px] border border-white/60 bg-white/80 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
          <p className="text-sm text-danger">{error}</p>
        </Card>
      ) : null}

      {loading && !snapshot ? (
        <Card className="rounded-[28px] border border-white/60 bg-white/80 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
          <p className="text-sm text-neutral-500">Cargando dashboard financiero real...</p>
        </Card>
      ) : null}

      {snapshot && kpis ? (
        <>
          <section className="space-y-4">
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

          <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
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
        className="fixed bottom-6 right-5 z-30 flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-[0_20px_60px_rgba(15,23,42,0.4)] sm:hidden"
      >
        Agregar gasto
      </Button>
    </div>
  );
}
