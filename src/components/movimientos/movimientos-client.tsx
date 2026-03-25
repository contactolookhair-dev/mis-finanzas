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
import { resolveAccountAppearance } from "@/lib/accounts/account-appearance";
import {
  buildTransactionQuery,
  TransactionRow,
  useTransactionsWithFilters
} from "@/hooks/use-transactions-with-filters";
import { BASE_TRANSACTION_MARKER } from "@/lib/constants/transactions";

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
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearInput, setClearInput] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
  const accountByName = useMemo(() => {
    return new Map(
      accounts.map((account) => [
        account.name.trim().toLowerCase(),
        account
      ])
    );
  }, [accounts]);
  const selectedAccount = useMemo(() => {
    if (!filters.accountId) return null;
    return accounts.find((account) => account.id === filters.accountId) ?? null;
  }, [accounts, filters.accountId]);
  const selectedAccountAppearance = useMemo(
    () => (selectedAccount ? resolveAccountAppearance(selectedAccount) : null),
    [selectedAccount]
  );
  const getAccountAppearance = (accountName: string) => {
    const matchedAccount = accountByName.get(accountName.trim().toLowerCase()) ?? null;
    return matchedAccount ? resolveAccountAppearance(matchedAccount) : null;
  };

  const totalIncome = useMemo(
    () => rows.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0),
    [rows]
  );

  const totalExpense = useMemo(
    () => rows.filter((row) => row.amount < 0).reduce((sum, row) => sum + Math.abs(row.amount), 0),
    [rows]
  );
  const hasRows = rows.length > 0;

  return (
    <div className="space-y-5 pb-16">
      <SectionHeader
        eyebrow="Dinero real"
        title="Movimientos"
        description="Lista operativa de ingresos, gastos y transferencias."
        actions={
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setOpenModal(true)} className="h-10 rounded-full px-4">
              Nuevo movimiento
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 rounded-full px-4 text-sm font-semibold"
              onClick={() => setClearOpen(true)}
            >
              Borrar todos los movimientos
            </Button>
          </div>
        }
      />

      {successMessage ? (
        <SurfaceCard
          variant="soft"
          padding="sm"
          className="border-emerald-200/80 bg-emerald-50/70 text-emerald-700"
        >
          {successMessage}
        </SurfaceCard>
      ) : null}

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
                {`${resolveAccountAppearance(account).glyph} ${account.name} · ${account.bank}`}
              </option>
            ))}
          </Select>
          {selectedAccountAppearance ? (
            <div
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700"
              style={{ borderColor: selectedAccountAppearance.accentColor }}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-sm"
                style={{
                  color: selectedAccountAppearance.accentColor,
                  backgroundColor: selectedAccountAppearance.accentBackground
                }}
              >
                {selectedAccountAppearance.glyph}
              </span>
              <div className="min-w-0">
                <p className="truncate">{selectedAccountAppearance.bankLabel}</p>
                <p className="text-[11px] font-medium text-slate-500">Filtro de cuenta activo</p>
              </div>
            </div>
          ) : null}
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
      ) : !hasRows ? (
        <EmptyStateCard
          title="Sin movimientos"
          description="Registra un gasto o ingreso para que esta pantalla muestre tu actividad."
          actionLabel="Crear movimiento"
          onAction={() => setOpenModal(true)}
        />
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <MovementMetric label="Ingresos" value={formatCurrency(totalIncome)} tone="text-emerald-600" />
            <MovementMetric label="Gastos" value={formatCurrency(totalExpense)} tone="text-rose-600" />
            <MovementMetric label="Saldo" value={formatCurrency(totalIncome - totalExpense)} tone="text-slate-900" />
          </div>

          <div className="grid gap-3">
            {rows.map((transaction) => (
              <MovementRow
                key={transaction.id}
                transaction={transaction}
                getAccountAppearance={getAccountAppearance}
                onDelete={() => {
                  if (transaction.description === BASE_TRANSACTION_MARKER) return;
                  setSelectedTransaction(transaction);
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {deleteOpen && selectedTransaction ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
          <SurfaceCard variant="soft" padding="lg" className="max-w-md space-y-4 bg-white/95 shadow-[0_30px_70px_rgba(15,23,42,0.25)] ring-1 ring-slate-100">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-rose-500">Eliminar movimiento</p>
              <h3 className="text-lg font-semibold text-slate-900">¿Eliminar este movimiento?</h3>
              <p className="mt-2 text-sm text-slate-600">
                Esta acción no se puede deshacer.
              </p>
            </div>
            <p className="text-sm text-slate-500">{selectedTransaction.description}</p>
            {deleteError ? <p className="text-xs text-rose-600">{deleteError}</p> : null}
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" className="h-10 rounded-full px-4" onClick={() => setDeleteOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="h-10 rounded-full px-4 bg-rose-600 text-white shadow-[0_10px_20px_rgba(220,91,103,0.4)]"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  setDeleteError(null);
                  try {
                    const response = await fetch(`/api/transactions/${selectedTransaction.id}`, { method: "DELETE" });
                    if (!response.ok) {
                      const body = await response.json();
                      throw new Error(body.message ?? "No se pudo eliminar el movimiento.");
                    }
                    refresh();
                    setDeleteOpen(false);
                    setSelectedTransaction(null);
                  } catch (error) {
                    setDeleteError(error instanceof Error ? error.message : "No se pudo eliminar.");
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                Eliminar
              </Button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {clearOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <SurfaceCard
            variant="soft"
            padding="lg"
            className="max-w-xl space-y-4 bg-white/95 shadow-[0_30px_70px_rgba(15,23,42,0.25)] ring-1 ring-slate-100"
          >
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Eliminar movimientos</p>
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Borrar todo el historial</h3>
              <p className="mt-2 text-sm text-slate-600">
                Esta acción eliminará todos los movimientos registrados. Las cuentas, pendientes,
                widgets y configuraciones no se verán afectadas.
              </p>
            </div>
            <p className="text-sm font-semibold text-rose-600">
              Escribe <span className="font-mono">ELIMINAR</span> para confirmar.
            </p>
            <Input
              placeholder="Escribe ELIMINAR"
              value={clearInput}
              onChange={(event) => setClearInput(event.target.value.toUpperCase())}
              autoFocus
              className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
            />
            {clearError ? <p className="text-xs text-rose-600">{clearError}</p> : null}
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="secondary"
                className="h-10 rounded-full px-4"
                onClick={() => {
                  setClearOpen(false);
                  setClearInput("");
                  setClearError(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="h-10 rounded-full px-4"
                disabled={clearInput !== "ELIMINAR" || clearing}
                onClick={async () => {
                  setClearing(true);
                  setClearError(null);
                  setSuccessMessage(null);
                  try {
                    const response = await fetch(`/api/transactions/clear?${buildTransactionQuery(filters)}`, {
                      method: "POST"
                    });
                    if (!response.ok) {
                      const body = await response.json();
                      throw new Error(body.message ?? "No se pudieron borrar los movimientos.");
                    }
                    setSuccessMessage("Todos los movimientos se eliminaron correctamente.");
                    refresh();
                    setClearOpen(false);
                    setClearInput("");
                  } catch (error) {
                    setClearError(error instanceof Error ? error.message : "No se pudo completar la operación.");
                  } finally {
                    setClearing(false);
                  }
                }}
              >
                Confirmar eliminación
              </Button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      <NewTransactionModal open={openModal} onOpenChange={setOpenModal} onSuccess={refresh} />
    </div>
  );
}

function MovementMetric({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/88 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function MovementRow({
  transaction,
  getAccountAppearance,
  onDelete
}: {
  transaction: TransactionRow;
  getAccountAppearance: (accountName: string) => ReturnType<typeof resolveAccountAppearance> | null;
  onDelete: () => void;
}) {
  const appearance = getAccountAppearance(transaction.account);
  const badgeTone = (TYPE_TONE[transaction.type] as "success" | "danger" | "warning" | "neutral") ?? "neutral";
  const creditMovementLabel =
    appearance?.kind === "TARJETA" && transaction.type !== "TRANSFERENCIA"
      ? transaction.amount < 0
        ? "Compra tarjeta"
        : "Pago tarjeta"
      : null;

  return (
    <SurfaceCard
      variant="soft"
      padding="sm"
      className="overflow-hidden border border-slate-200/80 bg-white/92 shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
    >
      <div className="flex items-start justify-between gap-3 sm:items-center">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={badgeTone}>{transaction.type === "INGRESO" ? "Ingreso" : transaction.type === "EGRESO" ? "Egreso" : "Transferencia"}</Badge>
            {creditMovementLabel ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {creditMovementLabel}
              </span>
            ) : null}
            <span className={`text-lg font-semibold ${transaction.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {formatCurrency(transaction.amount)}
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">{transaction.description}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{transaction.category}</span>
              <span>·</span>
              {appearance ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-2 py-0.5 font-semibold text-slate-700"
                  style={{ borderColor: appearance.accentColor }}
                >
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full text-[10px]"
                    style={{
                      color: appearance.accentColor,
                      backgroundColor: appearance.accentBackground
                    }}
                  >
                    {appearance.glyph}
                  </span>
                  {transaction.account}
                </span>
              ) : (
                <span>{transaction.account}</span>
              )}
              <span>·</span>
              <span>{formatDate(transaction.date)}</span>
            </div>
          </div>
        </div>

        {transaction.description !== BASE_TRANSACTION_MARKER ? (
          <button
            type="button"
            className="tap-feedback shrink-0 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
            onClick={onDelete}
          >
            Eliminar
          </button>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
