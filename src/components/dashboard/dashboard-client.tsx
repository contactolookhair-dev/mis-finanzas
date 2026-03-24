"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCcw, Sparkles } from "lucide-react";
import { BarChartCard, ComparisonBarChartCard, LineChartCard, PieChartCard } from "@/components/charts/chart-card";
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
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Filtros persistentes</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Input
          type="date"
          value={filters.startDate ?? ""}
          onChange={(event) => onChange({ startDate: event.target.value || undefined })}
        />
        <Input
          type="date"
          value={filters.endDate ?? ""}
          onChange={(event) => onChange({ endDate: event.target.value || undefined })}
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
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
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
        <Button variant="secondary" onClick={onReset}>
          Restablecer
        </Button>
      </div>
      {chips.length > 0 ? (
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
      ) : null}
    </Card>
  );
}

function RecentTransactionsList({ items }: { items: DashboardSnapshot["recentTransactions"] }) {
  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Movimientos recientes</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Lo último ingresado o importado dentro del filtro activo.
        </p>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? <p className="text-sm text-neutral-500">No hay movimientos en este rango.</p> : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-[22px] border border-white/80 bg-white/75 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{item.description}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {formatDate(item.date)} · {item.category} · {item.businessUnit}
                </p>
              </div>
              <p className={`text-sm font-semibold ${item.type === "INGRESO" ? "text-success" : "text-foreground"}`}>
                {formatCurrency(item.amount)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ImportActivityList({ items }: { items: DashboardSnapshot["importActivity"] }) {
  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Actividad reciente</h3>
        <p className="mt-1 text-sm text-neutral-500">Importaciones y cambios administrativos relevantes.</p>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? <p className="text-sm text-neutral-500">Sin actividad reciente registrada.</p> : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-[22px] border border-white/80 bg-white/75 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{item.userKey}</p>
              <span className="text-xs text-neutral-500">{formatDate(item.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              Importados: {Number(item.summary?.imported ?? 0)} · Duplicados: {Number(item.summary?.duplicates ?? 0)}
            </p>
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
            Panel principal
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">
            Dashboard financiero diario
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Filtros persistentes por usuario y lectura comparativa frente al período anterior.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {filters ? <ExportActions filters={filters} defaultReportType="dashboard_summary" compact /> : null}

      <FiltersRow
        filters={filters ?? {}}
        onChange={(patch) => setFilters((current) => ({ ...(current ?? {}), ...patch }))}
        onReset={() => setFilters(getDefaultRange())}
        snapshot={snapshot}
      />

      {error ? (
        <Card>
          <p className="text-sm text-danger">{error}</p>
        </Card>
      ) : null}

      {loading && !snapshot ? (
        <Card>
          <p className="text-sm text-neutral-500">Cargando dashboard financiero real...</p>
        </Card>
      ) : null}

      {snapshot && kpis ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Flujo neto"
              value={kpis.netFlow}
              detail="Resultado real del período filtrado"
              accent={kpis.netFlow >= 0 ? "emerald" : "sand"}
              comparison={{
                ...snapshot.comparisons.netFlow,
                previousLabel: "período anterior"
              }}
            />
            <StatCard
              label="Ingresos"
              value={kpis.incomes}
              detail={`${kpis.totalTransactions} movimientos considerados`}
              accent="emerald"
              comparison={{
                ...snapshot.comparisons.incomes,
                previousLabel: "período anterior"
              }}
            />
            <StatCard
              label="Egresos"
              value={kpis.expenses}
              detail="Gasto real detectado en la app"
              accent="sand"
              comparison={{
                ...snapshot.comparisons.expenses,
                previousLabel: "período anterior",
                invertTrend: true
              }}
            />
            <StatCard
              label="Dinero personal en empresas"
              value={kpis.personalMoneyInBusiness}
              detail="Pagos empresariales cubiertos por ti"
              accent="teal"
              comparison={{
                ...snapshot.comparisons.personalMoneyInBusiness,
                previousLabel: "período anterior",
                invertTrend: true
              }}
            />
            <StatCard
              label="Por cobrar"
              value={kpis.receivables}
              detail="Saldo pendiente de deudores"
              accent="ink"
              comparison={{
                ...snapshot.comparisons.receivables,
                previousLabel: "corte anterior"
              }}
            />
            <StatCard
              label="Movimientos revisados"
              value={kpis.reviewedTransactions}
              detail={`${kpis.reviewedRatio.toFixed(0)}% del total marcado como revisado`}
              accent="teal"
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
            <LineChartCard
              title="Tendencia mensual"
              description="Vista de 6 meses con ingresos, egresos y flujo neto para leer la trayectoria del negocio."
              data={snapshot.charts.trend}
            />
            <ComparisonSummary snapshot={snapshot} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <ComparisonBarChartCard
              title="Actual vs período anterior"
              description={`${snapshot.comparisons.currentPeriodLabel} frente a ${snapshot.comparisons.previousPeriodLabel}`}
              data={snapshot.comparisons.chart}
            />
            <InsightList insights={snapshot.insights} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <BarChartCard title="Gastos por categoria" data={snapshot.charts.categories} />
            <BarChartCard title="Gastos por unidad de negocio" data={snapshot.charts.businessUnits} />
            <PieChartCard
              title="Distribucion personal vs empresa"
              data={snapshot.charts.originMix}
              valueFormatter={formatCurrency}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <RecentTransactionsList items={snapshot.recentTransactions} />
            <ImportActivityList items={snapshot.importActivity} />
          </section>
        </>
      ) : null}
    </div>
  );
}
