"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Eye,
  PencilLine,
  Plus,
  Trash2,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyStateCard, ErrorStateCard, SkeletonCard } from "@/components/ui/states";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { SectionHeader } from "@/components/ui/section-header";
import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";
import {
  derivePayableStatus,
  sumPayables,
  todayISODate,
  type PayableItem,
  type PayableStatus
} from "./payables-storage";

type DebtorPerson = {
  id: string;
  name: string;
  reason: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: "PENDIENTE" | "ABONANDO" | "PAGADO" | "ATRASADO";
  isInstallmentDebt: boolean;
  installmentCount: number;
  installmentValue: number;
  paidInstallments: number;
  installmentsPending: number;
  nextInstallmentDate: string | null;
  installmentStatus: "AL_DIA" | "PROXIMA" | "VENCIDA" | "PAGADA";
  installmentStatusLabel: string;
  installmentDaysUntilDue: number | null;
};

type DebtsPayload = {
  people: DebtorPerson[];
  totals: {
    pendingPeople: number;
    pendingCompanies: number;
    pendingTotal: number;
  };
};

type ActiveTab = "me-deben" | "debo-pagar";

function toneForInstallmentStatus(status: DebtorPerson["installmentStatus"]) {
  if (status === "AL_DIA") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  if (status === "PROXIMA") return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
  if (status === "VENCIDA") return "bg-rose-50 text-rose-700 ring-1 ring-rose-100";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function toneForPayableStatus(status: PayableStatus) {
  if (status === "PAGADO") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  if (status === "VENCIDO") return "bg-rose-50 text-rose-700 ring-1 ring-rose-100";
  return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
}

function safeTitle(text: string) {
  const trimmed = text.trim();
  return trimmed.length ? trimmed : "Pendiente";
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function sumPendingThisMonth(people: DebtorPerson[]) {
  // Heuristica simple: si es deuda en cuotas, usamos installmentValue cuando aun hay cuotas pendientes.
  // Si es deuda unica, usamos pendingAmount como "por cobrar".
  return people.reduce((acc, item) => {
    if (item.pendingAmount <= 0) return acc;
    if (item.isInstallmentDebt && item.installmentsPending > 0) {
      return acc + Math.max(0, item.installmentValue);
    }
    return acc + Math.max(0, item.pendingAmount);
  }, 0);
}

export function PendientesClient({ initialTab }: { initialTab?: string }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    initialTab === "debo-pagar" ? "debo-pagar" : "me-deben"
  );
  const [debts, setDebts] = useState<DebtsPayload | null>(null);
  const [payables, setPayables] = useState<PayableItem[]>([]);
  const [loadingDebts, setLoadingDebts] = useState(true);
  const [errorDebts, setErrorDebts] = useState<string | null>(null);
  const [loadingPayables, setLoadingPayables] = useState(true);
  const [errorPayables, setErrorPayables] = useState<string | null>(null);

  const [payablesModalOpen, setPayablesModalOpen] = useState(false);
  const [editingPayableId, setEditingPayableId] = useState<string | null>(null);
  const [payableForm, setPayableForm] = useState({
    origin: "",
    amount: "",
    dueDate: todayISODate(),
    notes: ""
  });

  const [createDebtOpen, setCreateDebtOpen] = useState(false);
  const [debtCreateForm, setDebtCreateForm] = useState({
    name: "",
    reason: "",
    totalAmount: "",
    startDate: todayISODate(),
    notes: ""
  });
  const [debtSaving, setDebtSaving] = useState(false);
  const [debtError, setDebtError] = useState<string | null>(null);

  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);
  const selectedDebtor = useMemo(
    () => debts?.people.find((item) => item.id === selectedDebtorId) ?? null,
    [debts?.people, selectedDebtorId]
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paidAt: todayISODate(),
    notes: ""
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingDebt, setDeletingDebt] = useState(false);

  const todayISO = useMemo(() => todayISODate(), []);
  const meDebenTotal = debts?.totals.pendingTotal ?? 0;
  const deboPagarTotal = useMemo(() => sumPayables(payables.filter((p) => !p.paidAt)), [payables]);
  const porCobrarEsteMes = useMemo(
    () => (debts ? sumPendingThisMonth(debts.people) : 0),
    [debts]
  );

  async function loadDebts() {
    try {
      setLoadingDebts(true);
      setErrorDebts(null);
      const response = await fetch("/api/debts", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "No se pudieron cargar los pendientes.");
      }
      const payload = (await response.json()) as DebtsPayload;
      setDebts(payload);
    } catch (error) {
      setErrorDebts(error instanceof Error ? error.message : "Error cargando pendientes.");
    } finally {
      setLoadingDebts(false);
    }
  }

  async function loadPayables() {
    try {
      setLoadingPayables(true);
      setErrorPayables(null);
      const response = await fetch("/api/payables", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "No se pudieron cargar los pagos pendientes.");
      }
      const payload = (await response.json()) as { items?: PayableItem[] };
      setPayables(payload.items ?? []);
    } catch (error) {
      setErrorPayables(error instanceof Error ? error.message : "Error cargando pagos pendientes.");
      setPayables([]);
    } finally {
      setLoadingPayables(false);
    }
  }

  useEffect(() => {
    void loadDebts();
    void loadPayables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closePayablesModal() {
    setPayablesModalOpen(false);
    setEditingPayableId(null);
    setPayableForm({ origin: "", amount: "", dueDate: todayISODate(), notes: "" });
  }

  function openCreatePayable() {
    setEditingPayableId(null);
    setPayableForm({ origin: "", amount: "", dueDate: todayISODate(), notes: "" });
    setPayablesModalOpen(true);
  }

  function openEditPayable(item: PayableItem) {
    setEditingPayableId(item.id);
    setPayableForm({
      origin: item.origin,
      amount: `${item.amount}`,
      dueDate: item.dueDate.slice(0, 10),
      notes: item.notes ?? ""
    });
    setPayablesModalOpen(true);
  }

  function upsertPayable() {
    const origin = safeTitle(payableForm.origin);
    const amount = Number(payableForm.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const dueDate = payableForm.dueDate || todayISODate();
    const notes = payableForm.notes?.trim() || null;
    async function run() {
      try {
        setErrorPayables(null);
        if (editingPayableId) {
          const response = await fetch(`/api/payables/${editingPayableId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ origin, amount, dueDate, notes })
          });
          const payload = (await response.json()) as { message?: string };
          if (!response.ok) throw new Error(payload.message ?? "No se pudo guardar el pendiente.");
        } else {
          const response = await fetch("/api/payables", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ origin, amount, dueDate, notes })
          });
          const payload = (await response.json()) as { message?: string };
          if (!response.ok) throw new Error(payload.message ?? "No se pudo guardar el pendiente.");
        }
        closePayablesModal();
        await loadPayables();
      } catch (error) {
        setErrorPayables(error instanceof Error ? error.message : "No se pudo guardar el pendiente.");
      }
    }
    void run();
  }

  function deletePayable(id: string) {
    async function run() {
      try {
        setErrorPayables(null);
        const response = await fetch(`/api/payables/${id}`, { method: "DELETE" });
        const payload = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(payload.message ?? "No se pudo eliminar el pendiente.");
        await loadPayables();
      } catch (error) {
        setErrorPayables(error instanceof Error ? error.message : "No se pudo eliminar el pendiente.");
      }
    }
    void run();
  }

  function togglePayablePaid(id: string, paid: boolean) {
    const paidAt = paid ? todayISODate() : null;
    async function run() {
      try {
        setErrorPayables(null);
        const response = await fetch(`/api/payables/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paidAt })
        });
        const payload = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(payload.message ?? "No se pudo actualizar el pendiente.");
        await loadPayables();
      } catch (error) {
        setErrorPayables(error instanceof Error ? error.message : "No se pudo actualizar el pendiente.");
      }
    }
    void run();
  }

  const payablesSorted = useMemo(() => {
    const items = [...payables];
    items.sort((a, b) => {
      const aStatus = derivePayableStatus(a, todayISO);
      const bStatus = derivePayableStatus(b, todayISO);
      const statusRank: Record<PayableStatus, number> = { VENCIDO: 0, PROXIMO: 1, PAGADO: 2 };
      const rank = statusRank[aStatus] - statusRank[bStatus];
      if (rank !== 0) return rank;
      return a.dueDate.localeCompare(b.dueDate);
    });
    return items;
  }, [payables, todayISO]);

  const isMobileTabs = true;

  return (
    <PageContainer className="space-y-6">
      <SectionHeader
        title="Pendientes"
        description="Controla lo que te deben y lo que debes pagar en una sola vista."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <SurfaceCard className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Me deben
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
            {formatCurrency(meDebenTotal)}
          </p>
          <p className="mt-2 text-sm text-slate-600">Total pendiente por cobrar.</p>
        </SurfaceCard>
        <SurfaceCard className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Debo pagar
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
            {formatCurrency(deboPagarTotal)}
          </p>
          <p className="mt-2 text-sm text-slate-600">Compromisos pendientes de pago.</p>
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-2 sm:p-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={activeTab === "me-deben" ? "default" : "secondary"}
            className={cn("h-10 flex-1 rounded-2xl text-sm", !isMobileTabs && "flex-initial")}
            onClick={() => setActiveTab("me-deben")}
          >
            <Users className="mr-2 h-4 w-4" />
            Me deben
          </Button>
          <Button
            type="button"
            variant={activeTab === "debo-pagar" ? "default" : "secondary"}
            className={cn("h-10 flex-1 rounded-2xl text-sm", !isMobileTabs && "flex-initial")}
            onClick={() => setActiveTab("debo-pagar")}
          >
            <CalendarClock className="mr-2 h-4 w-4" />
            Debo pagar
          </Button>
        </div>
      </SurfaceCard>

      {activeTab === "me-deben" ? (
        <SurfaceCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                Me deben
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Por cobrar este mes:{" "}
                <span className="font-semibold text-slate-900">
                  {formatCurrency(porCobrarEsteMes)}
                </span>
              </p>
            </div>
            <Button
              type="button"
              variant="default"
              className="h-10 rounded-2xl px-4 text-sm"
              onClick={() => {
                setDebtError(null);
                setCreateDebtOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Registrar deuda
            </Button>
          </div>

          {loadingDebts ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : errorDebts ? (
            <div className="mt-4">
              <ErrorStateCard
                title="No se pudieron cargar los pendientes"
                description={errorDebts}
              />
            </div>
          ) : debts && debts.people.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {debts.people.map((person) => {
                const statusChip = toneForInstallmentStatus(person.installmentStatus);
                const installmentText = person.isInstallmentDebt
                  ? `${person.paidInstallments}/${person.installmentCount}`
                  : "Pago unico";
                const currentInstallment =
                  person.isInstallmentDebt && person.installmentsPending > 0
                    ? person.installmentValue
                    : Math.max(0, person.pendingAmount);
                const labelCuota = person.isInstallmentDebt ? "Cuota del mes" : "Pendiente";

                return (
                  <SurfaceCard key={person.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold tracking-[-0.02em] text-slate-900">
                          {person.name}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">
                          {person.reason}
                        </p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold", statusChip)}>
                        {person.installmentStatusLabel}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          {labelCuota}
                        </p>
                        <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-900">
                          {formatCurrency(currentInstallment)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Total pendiente
                        </p>
                        <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-900">
                          {formatCurrency(person.pendingAmount)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <StatPill tone="neutral">Cuotas {installmentText}</StatPill>
                        {person.nextInstallmentDate ? (
                          <StatPill
                            tone="neutral"
                          >
                            Proxima: {formatDate(person.nextInstallmentDate)}
                          </StatPill>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-9 rounded-2xl px-3 text-sm"
                          onClick={() => {
                            setSelectedDebtorId(person.id);
                            setPaymentForm({ amount: "", paidAt: todayISODate(), notes: "" });
                            setPaymentError(null);
                            setPaymentOpen(true);
                          }}
                        >
                          Registrar pago
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 rounded-2xl px-3 text-sm"
                          onClick={() => {
                            setSelectedDebtorId(person.id);
                            setDetailOpen(true);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Detalle
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 rounded-2xl px-3 text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => {
                            setSelectedDebtorId(person.id);
                            setDeleteConfirmOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </SurfaceCard>
                );
              })}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyStateCard
                title="No tienes cobros pendientes registrados"
                description="Cuando registres un gasto como prestado o crees una deuda, aparecerá aquí."
                actionLabel="Registrar deuda"
                onAction={() => {
                  setDebtError(null);
                  setCreateDebtOpen(true);
                }}
              />
            </div>
          )}
        </SurfaceCard>
      ) : (
        <SurfaceCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                Debo pagar
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Registra compromisos de pago (tarjetas, prestamos o cuotas) y marca cuando los pagues.
              </p>
            </div>
            <Button
              type="button"
              variant="default"
              className="h-10 rounded-2xl px-4 text-sm"
              onClick={openCreatePayable}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo
            </Button>
          </div>

          {loadingPayables ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : errorPayables ? (
            <div className="mt-4">
              <ErrorStateCard
                title="No se pudieron cargar tus pagos"
                description={errorPayables}
                onRetry={() => void loadPayables()}
              />
            </div>
          ) : payablesSorted.length === 0 ? (
            <div className="mt-4">
              <EmptyStateCard
                title="No tienes pagos pendientes"
                description="Agrega un compromiso para ver aquí lo que debes pagar."
                actionLabel="Agregar pendiente"
                onAction={openCreatePayable}
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {payablesSorted.map((item) => {
                const status = derivePayableStatus(item, todayISO);
                const statusClass = toneForPayableStatus(status);
                const secondary =
                  status === "PAGADO"
                    ? item.paidAt
                      ? `Pagado: ${formatDate(item.paidAt)}`
                      : "Pagado"
                    : `Vence: ${formatDate(item.dueDate)}`;
                return (
                  <SurfaceCard key={item.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold tracking-[-0.02em] text-slate-900">
                          {item.origin}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-600">{secondary}</p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold",
                          statusClass
                        )}
                      >
                        {status === "PAGADO" ? "Pagado" : status === "VENCIDO" ? "Vencido" : "Proximo"}
                      </span>
                    </div>

                    <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
                      {formatCurrency(item.amount)}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant={status === "PAGADO" ? "secondary" : "default"}
                        className="h-9 rounded-2xl px-3 text-sm"
                        onClick={() => togglePayablePaid(item.id, status !== "PAGADO")}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {status === "PAGADO" ? "Desmarcar" : "Marcar pagado"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-9 rounded-2xl px-3 text-sm"
                        onClick={() => openEditPayable(item)}
                      >
                        <PencilLine className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 rounded-2xl px-3 text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => deletePayable(item.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  </SurfaceCard>
                );
              })}
            </div>
          )}

          {payablesModalOpen ? (
            <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
              <button
                type="button"
                aria-label="Cerrar"
                className="absolute inset-0 bg-black/40 backdrop-blur-[10px]"
                onClick={closePayablesModal}
              />
              <SurfaceCard className="relative w-full max-w-lg p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                      {editingPayableId ? "Editar pago pendiente" : "Nuevo pago pendiente"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Se guarda por workspace para que no pierdas tus compromisos.
                    </p>
                  </div>
                  <Button type="button" variant="ghost" className="h-9 rounded-2xl" onClick={closePayablesModal}>
                    Cerrar
                  </Button>
                </div>

                <div className="mt-4 grid gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Origen
                    </p>
                    <Input
                      value={payableForm.origin}
                      onChange={(event) => setPayableForm((current) => ({ ...current, origin: event.target.value }))}
                      placeholder="Ej: Tarjeta Falabella, Prestamo, Cuota..."
                      className="mt-2"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Monto
                      </p>
                      <Input
                        value={payableForm.amount}
                        onChange={(event) => setPayableForm((current) => ({ ...current, amount: event.target.value }))}
                        inputMode="numeric"
                        placeholder="Ej: 45000"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Fecha pago
                      </p>
                      <Input
                        value={payableForm.dueDate}
                        onChange={(event) => setPayableForm((current) => ({ ...current, dueDate: event.target.value }))}
                        type="date"
                        className="mt-2"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Nota (opcional)
                    </p>
                    <Input
                      value={payableForm.notes}
                      onChange={(event) => setPayableForm((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="Ej: pago minimo, cuota 3/12..."
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" className="h-10 rounded-2xl px-4" onClick={closePayablesModal}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    className="h-10 rounded-2xl px-4"
                    onClick={upsertPayable}
                    disabled={Number(payableForm.amount || 0) <= 0}
                  >
                    Guardar
                  </Button>
                </div>
              </SurfaceCard>
            </div>
          ) : null}
        </SurfaceCard>
      )}

      {createDebtOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/40 backdrop-blur-[10px]"
            onClick={() => setCreateDebtOpen(false)}
          />
          <SurfaceCard className="relative w-full max-w-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                  Registrar deuda
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Registra un cobro pendiente a una persona.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-2xl"
                onClick={() => setCreateDebtOpen(false)}
              >
                Cerrar
              </Button>
            </div>

            {debtError ? (
              <div className="mt-4">
              <ErrorStateCard title="No se pudo guardar" description={debtError} />
              </div>
            ) : null}

            <div className="mt-4 grid gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Nombre
                </p>
                <Input
                  value={debtCreateForm.name}
                  onChange={(event) =>
                    setDebtCreateForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Ej: Sebastian"
                  className="mt-2"
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Motivo
                </p>
                <Input
                  value={debtCreateForm.reason}
                  onChange={(event) =>
                    setDebtCreateForm((current) => ({ ...current, reason: event.target.value }))
                  }
                  placeholder="Ej: Computador en cuotas"
                  className="mt-2"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Monto total
                  </p>
                  <Input
                    value={debtCreateForm.totalAmount}
                    onChange={(event) =>
                      setDebtCreateForm((current) => ({
                        ...current,
                        totalAmount: event.target.value
                      }))
                    }
                    inputMode="numeric"
                    placeholder="Ej: 280000"
                    className="mt-2"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Fecha
                  </p>
                  <Input
                    value={debtCreateForm.startDate}
                    onChange={(event) =>
                      setDebtCreateForm((current) => ({
                        ...current,
                        startDate: event.target.value
                      }))
                    }
                    type="date"
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Nota (opcional)
                </p>
                <Input
                  value={debtCreateForm.notes}
                  onChange={(event) =>
                    setDebtCreateForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Ej: acuerdo de pago, detalles..."
                  className="mt-2"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-2xl px-4"
                onClick={() => setCreateDebtOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="default"
                className="h-10 rounded-2xl px-4"
                disabled={debtSaving || debtCreateForm.name.trim().length < 3 || Number(debtCreateForm.totalAmount || 0) <= 0}
                onClick={async () => {
                  try {
                    setDebtSaving(true);
                    setDebtError(null);
                    const response = await fetch("/api/debts", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: debtCreateForm.name.trim(),
                        reason: debtCreateForm.reason.trim() || "Deuda manual",
                        totalAmount: Number(debtCreateForm.totalAmount || 0),
                        startDate: debtCreateForm.startDate || todayISODate(),
                        estimatedPayDate: null,
                        notes: debtCreateForm.notes.trim() || null
                      })
                    });
                    const payload = (await response.json()) as { message?: string };
                    if (!response.ok) throw new Error(payload.message ?? "No se pudo registrar la deuda.");
                    setCreateDebtOpen(false);
                    setDebtCreateForm({
                      name: "",
                      reason: "",
                      totalAmount: "",
                      startDate: todayISODate(),
                      notes: ""
                    });
                    await loadDebts();
                  } catch (error) {
                    setDebtError(error instanceof Error ? error.message : "No se pudo registrar la deuda.");
                  } finally {
                    setDebtSaving(false);
                  }
                }}
              >
                {debtSaving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {paymentOpen && selectedDebtor ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/40 backdrop-blur-[10px]"
            onClick={() => setPaymentOpen(false)}
          />
          <SurfaceCard className="relative w-full max-w-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                  Registrar pago
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedDebtor.name} · {formatCurrency(selectedDebtor.pendingAmount)} pendiente
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-2xl"
                onClick={() => setPaymentOpen(false)}
              >
                Cerrar
              </Button>
            </div>

            {paymentError ? (
              <div className="mt-4">
                <ErrorStateCard title="No se pudo registrar el pago" description={paymentError} />
              </div>
            ) : null}

            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Monto
                  </p>
                  <Input
                    value={paymentForm.amount}
                    onChange={(event) =>
                      setPaymentForm((current) => ({ ...current, amount: event.target.value }))
                    }
                    inputMode="numeric"
                    placeholder="Ej: 40000"
                    className="mt-2"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Fecha
                  </p>
                  <Input
                    value={paymentForm.paidAt}
                    onChange={(event) =>
                      setPaymentForm((current) => ({ ...current, paidAt: event.target.value }))
                    }
                    type="date"
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Nota (opcional)
                </p>
                <Input
                  value={paymentForm.notes}
                  onChange={(event) =>
                    setPaymentForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Ej: pago minimo, transferencia..."
                  className="mt-2"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-2xl px-4"
                onClick={() => setPaymentOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="default"
                className="h-10 rounded-2xl px-4"
                disabled={paymentSaving || Number(paymentForm.amount || 0) <= 0}
                onClick={async () => {
                  try {
                    setPaymentSaving(true);
                    setPaymentError(null);
                    const response = await fetch(`/api/debts/${selectedDebtor.id}/payments`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        amount: Number(paymentForm.amount || 0),
                        paidAt: paymentForm.paidAt || todayISODate(),
                        notes: paymentForm.notes.trim() || null
                      })
                    });
                    const payload = (await response.json()) as { message?: string };
                    if (!response.ok) throw new Error(payload.message ?? "No se pudo registrar el pago.");
                    setPaymentOpen(false);
                    setSelectedDebtorId(null);
                    await loadDebts();
                  } catch (error) {
                    setPaymentError(error instanceof Error ? error.message : "No se pudo registrar el pago.");
                  } finally {
                    setPaymentSaving(false);
                  }
                }}
              >
                {paymentSaving ? "Guardando..." : "Registrar"}
              </Button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {detailOpen && selectedDebtor ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/40 backdrop-blur-[10px]"
            onClick={() => setDetailOpen(false)}
          />
          <SurfaceCard className="relative w-full max-w-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                  {selectedDebtor.name}
                </p>
                <p className="mt-1 text-sm text-slate-600">{selectedDebtor.reason}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-2xl"
                onClick={() => setDetailOpen(false)}
              >
                Cerrar
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <SurfaceCard className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Total
                </p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-900">
                  {formatCurrency(selectedDebtor.totalAmount)}
                </p>
              </SurfaceCard>
              <SurfaceCard className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Pendiente
                </p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-900">
                  {formatCurrency(selectedDebtor.pendingAmount)}
                </p>
              </SurfaceCard>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <StatPill tone="neutral">
                {selectedDebtor.isInstallmentDebt
                  ? `Cuotas: ${selectedDebtor.paidInstallments}/${selectedDebtor.installmentCount}`
                  : "Pago unico"}
              </StatPill>
              {selectedDebtor.nextInstallmentDate ? (
                <StatPill tone="neutral">
                  Proxima: {formatDate(selectedDebtor.nextInstallmentDate)}
                </StatPill>
              ) : null}
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold",
                  toneForInstallmentStatus(selectedDebtor.installmentStatus)
                )}
              >
                {selectedDebtor.installmentStatusLabel}
              </span>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-2xl px-4"
                onClick={() => {
                  setDetailOpen(false);
                  setPaymentForm({ amount: "", paidAt: todayISODate(), notes: "" });
                  setPaymentError(null);
                  setPaymentOpen(true);
                }}
              >
                Registrar pago
              </Button>
              <Button
                type="button"
                variant="default"
                className="h-10 rounded-2xl px-4"
                onClick={() => {
                  window.open(`/api/debts/${selectedDebtor.id}/export`, "_blank");
                }}
              >
                Descargar PDF
              </Button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {deleteConfirmOpen && selectedDebtor ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/40 backdrop-blur-[10px]"
            onClick={() => setDeleteConfirmOpen(false)}
          />
          <SurfaceCard className="relative w-full max-w-lg p-5">
            <p className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
              ¿Eliminar este pendiente?
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Se eliminará la deuda de <span className="font-semibold text-slate-900">{selectedDebtor.name}</span>. Esta acción no se puede deshacer.
            </p>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-2xl px-4"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="default"
                className="h-10 rounded-2xl px-4"
                // Force destructive styling without introducing a new variant.
                // Button variants are intentionally small; keep semantics with color only here.
                style={{ backgroundColor: "#DC2626" }}
                disabled={deletingDebt}
                onClick={async () => {
                  try {
                    setDeletingDebt(true);
                    const response = await fetch(`/api/debts/${selectedDebtor.id}`, {
                      method: "DELETE"
                    });
                    const payload = (await response.json()) as { message?: string };
                    if (!response.ok) throw new Error(payload.message ?? "No se pudo eliminar la deuda.");
                    setDeleteConfirmOpen(false);
                    setDetailOpen(false);
                    setPaymentOpen(false);
                    setSelectedDebtorId(null);
                    await loadDebts();
                  } catch (error) {
                    setErrorDebts(error instanceof Error ? error.message : "No se pudo eliminar la deuda.");
                    setDeleteConfirmOpen(false);
                  } finally {
                    setDeletingDebt(false);
                  }
                }}
              >
                {deletingDebt ? "Eliminando..." : "Eliminar"}
              </Button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}
    </PageContainer>
  );
}
