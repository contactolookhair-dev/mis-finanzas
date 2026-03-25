"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SectionHeader } from "@/components/ui/section-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { SkeletonCard, ErrorStateCard, EmptyStateCard } from "@/components/ui/states";
import { NewTransactionModal } from "@/components/movimientos/new-transaction-modal";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { useTransactionsWithFilters } from "@/hooks/use-transactions-with-filters";

const QUICK_RANGE_LABELS: Record<string, string> = {
  today: "Hoy",
  week: "Semana",
  month: "Mes"
};

const TYPE_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  INGRESO: "success",
  EGRESO: "danger",
  TRANSFERENCIA: "warning"
};

export function MovimientosClient() {
  const [openModal, setOpenModal] = useState(false);
  const {
    rows,
    loading,
    error,
    filters,
    setFilters,
    accounts,
    categories,
    refresh
  } = useTransactionsWithFilters();

  const quickRange = filters.range ?? "today";

  const totalIncome = useMemo(
    () => rows.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0),
    [rows]
  );

  const totalExpense = useMemo(
    () => rows.filter((row) => row.amount < 0).reduce((sum, row) => sum + Math.abs(row.amount), 0),
    [rows]
  );

  return (
    <div className="space-y-5 pb-16">
      <SectionHeader
        eyebrow="Dinero real"
        title="Movimientos"
        description="Lista operativa de ingresos, gastos y transferencias."
        actions={
          <Button onClick={() => setOpenModal(true)} className="h-10 rounded-full px-4">
            Nuevo movimiento
          </Button>
        }
      />

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-3 sm:text-[0.75rem]">
        <div className="flex flex-wrap gap-2">
          {Object.entries(QUICK_RANGE_LABELS).map(([key, label]) => (
            <Button
              key={key}
              variant={quickRange === key ? "ghost" : "secondary"}
              size="sm"
              className="rounded-full px-3 text-xs font-semibold"
              onClick={() => setFilters((prev) => ({ ...prev, range: key as "today" | "week" | "month" }))}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <span className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">Balance</span>
          <p className="text-base font-semibold text-emerald-600">{formatCurrency(totalIncome)}</p>
          <p className="text-base font-semibold text-rose-600">{formatCurrency(totalExpense)}</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="grid gap-3 sm:grid-cols-4">
          <Input
            placeholder="Buscar descripción"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          />
          <Select
            value={filters.accountId}
            onChange={(event) => setFilters((prev) => ({ ...prev, accountId: event.target.value }))}
          >
            <option value="">Todas las cuentas</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.categoryId}
            onChange={(event) => setFilters((prev) => ({ ...prev, categoryId: event.target.value }))}
          >
            <option value="">Todas las categorías</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.type}
            onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value as "INGRESO" | "EGRESO" | "" }))}
          >
            <option value="">Todos los tipos</option>
            <option value="INGRESO">Ingreso</option>
            <option value="EGRESO">Gasto</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <SkeletonCard lines={4} />
      ) : error ? (
        <ErrorStateCard title="No se pudieron cargar los movimientos" details={error} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyStateCard
          title="Sin movimientos"
          description="Registra un gasto o ingreso para que esta pantalla muestre tu actividad."
          actionLabel="Crear movimiento"
          onAction={() => setOpenModal(true)}
        />
      ) : (
        <div className="space-y-3">
          <div className="mt-0 grid gap-3 md:hidden">
            {rows.map((transaction) => (
              <SurfaceCard key={transaction.id} variant="soft" padding="sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{transaction.description}</p>
                    <p className="text-xs text-slate-500">
                      {transaction.category} · {transaction.account}
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(transaction.date)}</p>
                  </div>
                  <div className="text-right">
                    <span className="mb-1 inline-flex text-[0.65rem]">
                      <Badge tone={(TYPE_TONE[transaction.type] as "success" | "danger" | "warning" | "neutral") ?? "neutral"}>
                        {transaction.type}
                      </Badge>
                    </span>
                    <p className={`text-xl font-semibold ${transaction.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatCurrency(transaction.amount)}
                    </p>
                  </div>
                </div>
              </SurfaceCard>
            ))}
          </div>
          <div className="hidden divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)] md:block">
            <div className="grid gap-1 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 md:grid-cols-[2fr_1fr_1fr_1fr]">
              <span className="md:col-span-1">Descripción</span>
              <span className="text-right">Categoría · Cuenta</span>
              <span className="text-right">Monto</span>
              <span className="text-right">Fecha</span>
            </div>
            {rows.map((transaction) => (
              <div
                key={transaction.id}
                className="grid gap-1 px-4 py-3 hover:bg-slate-50 md:grid-cols-[2fr_1fr_1fr_1fr]"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{transaction.description}</p>
                  <span className="mt-1 inline-flex text-[0.6rem]">
                    <Badge tone="neutral">{transaction.type}</Badge>
                  </span>
                </div>
                <div className="text-right text-sm text-slate-600">
                  {transaction.category}
                  <br />
                  <span className="text-xs text-slate-400">{transaction.account}</span>
                </div>
                <div className={`text-right text-lg font-semibold ${transaction.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatCurrency(transaction.amount)}
                </div>
                <div className="text-right text-xs text-slate-500">{formatDate(transaction.date)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <NewTransactionModal open={openModal} onOpenChange={setOpenModal} onSuccess={refresh} />
    </div>
  );
}
