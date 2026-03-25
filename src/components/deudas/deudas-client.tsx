"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Eye, PencilLine, Clock3, CreditCard, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import { EmptyStateCard, ErrorStateCard, SkeletonCard } from "@/components/ui/states";
import { Input } from "@/components/ui/input";
import { MobileStickyAction } from "@/components/ui/mobile-sticky-action";
import { SectionHeader } from "@/components/ui/section-header";
import { Select } from "@/components/ui/select";
import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";

type CompanyDebt = {
  id: string;
  name: string;
  reason: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: "PENDIENTE" | "ABONANDO" | "PAGADO";
  entries: Array<{
    id: string;
    amount: number;
    status: string;
    reimbursedAt: string | null;
    notes: string | null;
    createdAt: string;
  }>;
};

type PersonDebt = {
  id: string;
  name: string;
  reason: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: "PENDIENTE" | "ABONANDO" | "PAGADO" | "ATRASADO";
  startDate: string;
  estimatedPayDate: string | null;
  isInstallmentDebt: boolean;
  installmentCount: number;
  installmentValue: number;
  paidInstallments: number;
  installmentFrequency: "SEMANAL" | "QUINCENAL" | "MENSUAL" | "ANUAL";
  nextInstallmentDate: string | null;
  installmentsPending: number;
  installmentProgress: number;
  installmentRemainingAmount: number;
  installmentStatus: "AL_DIA" | "PROXIMA" | "VENCIDA" | "PAGADA";
  installmentStatusLabel: string;
  installmentDaysUntilDue: number | null;
  notes: string | null;
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    notes: string | null;
  }>;
};

type SelectedDebt =
  | { kind: "person"; id: string }
  | { kind: "company"; id: string };

type DebtsPayload = {
  companies: CompanyDebt[];
  people: PersonDebt[];
  totals: {
    pendingCompanies: number;
    pendingPeople: number;
    pendingTotal: number;
    collectedTotal: number;
  };
  commitments: {
    activeInstallmentDebts: number;
    monthlyCommittedTotal: number;
    upcomingCount: number;
    overdueCount: number;
    nextDueDate: string | null;
    nextDueDebtName: string | null;
    upcomingTimeline: Array<{
      debtId: string;
      debtName: string;
      reason: string;
      dueDate: string;
      amount: number;
      health: "AL_DIA" | "PROXIMA" | "VENCIDA" | "PAGADA";
      daysUntilDue: number;
    }>;
  };
};

const statusLabel: Record<PersonDebt["status"], string> = {
  PENDIENTE: "Pendiente",
  ABONANDO: "Abonando",
  PAGADO: "Pagado",
  ATRASADO: "Atrasado"
};

const installmentFrequencyLabel: Record<PersonDebt["installmentFrequency"], string> = {
  SEMANAL: "Semanal",
  QUINCENAL: "Quincenal",
  MENSUAL: "Mensual",
  ANUAL: "Anual"
};

const installmentTone: Record<
  PersonDebt["installmentStatus"],
  { chip: string; bar: string }
> = {
  AL_DIA: {
    chip: "bg-emerald-50 text-emerald-700",
    bar: "from-emerald-400 via-teal-400 to-cyan-400"
  },
  PROXIMA: {
    chip: "bg-amber-50 text-amber-700",
    bar: "from-amber-400 via-orange-400 to-fuchsia-400"
  },
  VENCIDA: {
    chip: "bg-rose-50 text-rose-700",
    bar: "from-rose-400 via-fuchsia-400 to-violet-400"
  },
  PAGADA: {
    chip: "bg-slate-100 text-slate-700",
    bar: "from-slate-300 via-slate-300 to-slate-300"
  }
};

function relativeInstallmentText(daysUntilDue: number | null) {
  if (daysUntilDue === null) return "Sin fecha";
  if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)} dias de atraso`;
  if (daysUntilDue === 0) return "Vence hoy";
  if (daysUntilDue === 1) return "Vence manana";
  return `Vence en ${daysUntilDue} dias`;
}

function todayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const formFieldLabelClass = "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500";
const formTextareaClass =
  "min-h-[96px] w-full rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm outline-none focus:border-violet-400";

export function DeudasClient({
  initialTab,
  initialAction
}: {
  initialTab?: string;
  initialAction?: string;
}) {
  const [tab, setTab] = useState<"empresas" | "personas">(
    initialTab === "personas" ? "personas" : "empresas"
  );
  const [payload, setPayload] = useState<DebtsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"none" | "nueva" | "abono" | "editar">("none");
  const [activeDebtorId, setActiveDebtorId] = useState<string>("");
  const [selectedDebt, setSelectedDebt] = useState<SelectedDebt | null>(null);
  const [exportingDebt, setExportingDebt] = useState<string | null>(null);
  const [settlingDebt, setSettlingDebt] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    name: "",
    reason: "",
    totalAmount: "",
    startDate: todayDate(),
    estimatedPayDate: "",
    isInstallmentDebt: "no",
    installmentCount: "",
    installmentValue: "",
    paidInstallments: "",
    installmentFrequency: "MENSUAL",
    nextInstallmentDate: "",
    notes: ""
  });
  const [paymentForm, setPaymentForm] = useState({
    debtorId: "",
    amount: "",
    paidAt: todayDate(),
    notes: ""
  });
  const [editForm, setEditForm] = useState({
    name: "",
    reason: "",
    totalAmount: "",
    status: "PENDIENTE",
    estimatedPayDate: "",
    isInstallmentDebt: "no",
    installmentCount: "",
    installmentValue: "",
    paidInstallments: "",
    installmentFrequency: "MENSUAL",
    nextInstallmentDate: "",
    notes: ""
  });

  async function loadDebts() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/debts", { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudieron cargar las deudas.");
      const nextPayload = (await response.json()) as DebtsPayload;
      setPayload(nextPayload);
      if (!activeDebtorId && nextPayload.people[0]) {
        setActiveDebtorId(nextPayload.people[0].id);
        setPaymentForm((current) => ({ ...current, debtorId: nextPayload.people[0].id }));
      }
      if (!selectedDebt) {
        if (nextPayload.people[0]) {
          setSelectedDebt({ kind: "person", id: nextPayload.people[0].id });
        } else if (nextPayload.companies[0]) {
          setSelectedDebt({ kind: "company", id: nextPayload.companies[0].id });
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error cargando deudas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDebts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialAction === "nueva" || initialAction === "abono") {
      setFormMode(initialAction);
    }
  }, [initialAction]);

  const selectedDebtor = useMemo(
    () => payload?.people.find((item) => item.id === activeDebtorId) ?? null,
    [payload?.people, activeDebtorId]
  );

  async function handleCreateDebt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          totalAmount: Number(createForm.totalAmount),
          isInstallmentDebt: createForm.isInstallmentDebt === "si",
          installmentCount: createForm.installmentCount ? Number(createForm.installmentCount) : 0,
          installmentValue: createForm.installmentValue ? Number(createForm.installmentValue) : 0,
          paidInstallments: createForm.paidInstallments ? Number(createForm.paidInstallments) : 0,
          installmentFrequency: createForm.isInstallmentDebt === "si" ? createForm.installmentFrequency : "MENSUAL",
          estimatedPayDate: createForm.estimatedPayDate || null,
          nextInstallmentDate: createForm.nextInstallmentDate || null,
          notes: createForm.notes || null
        })
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "No se pudo registrar la deuda.");
      setMessage("Deuda registrada correctamente.");
      setCreateForm({
        name: "",
        reason: "",
        totalAmount: "",
        startDate: todayDate(),
        estimatedPayDate: "",
        isInstallmentDebt: "no",
        installmentCount: "",
        installmentValue: "",
        paidInstallments: "",
        installmentFrequency: "MENSUAL",
        nextInstallmentDate: "",
        notes: ""
      });
      await loadDebts();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo registrar la deuda.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentForm.debtorId) {
      setError("Selecciona una deuda para registrar abono.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/debts/${paymentForm.debtorId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(paymentForm.amount),
          paidAt: paymentForm.paidAt,
          notes: paymentForm.notes || null
        })
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "No se pudo registrar el abono.");
      setMessage("Abono registrado correctamente.");
      setPaymentForm((current) => ({ ...current, amount: "", notes: "" }));
      await loadDebts();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo registrar el abono.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditDebt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeDebtorId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/debts/${activeDebtorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          totalAmount: Number(editForm.totalAmount),
          isInstallmentDebt: editForm.isInstallmentDebt === "si",
          installmentCount: editForm.installmentCount ? Number(editForm.installmentCount) : 0,
          installmentValue: editForm.installmentValue ? Number(editForm.installmentValue) : 0,
          paidInstallments: editForm.paidInstallments ? Number(editForm.paidInstallments) : 0,
          installmentFrequency: editForm.isInstallmentDebt === "si" ? editForm.installmentFrequency : "MENSUAL",
          estimatedPayDate: editForm.estimatedPayDate || null,
          nextInstallmentDate: editForm.nextInstallmentDate || null,
          notes: editForm.notes || null
        })
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "No se pudo editar la deuda.");
      setMessage("Deuda actualizada correctamente.");
      await loadDebts();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo editar la deuda.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(debt: PersonDebt) {
    setSelectedDebt({ kind: "person", id: debt.id });
    setActiveDebtorId(debt.id);
    setFormMode("editar");
    setEditForm({
      name: debt.name,
      reason: debt.reason,
      totalAmount: `${debt.totalAmount}`,
      status: debt.status,
      estimatedPayDate: debt.estimatedPayDate ? debt.estimatedPayDate.slice(0, 10) : "",
      isInstallmentDebt: debt.isInstallmentDebt ? "si" : "no",
      installmentCount: debt.installmentCount ? `${debt.installmentCount}` : "",
      installmentValue: debt.installmentValue ? `${debt.installmentValue}` : "",
      paidInstallments: debt.paidInstallments ? `${debt.paidInstallments}` : "",
      installmentFrequency: debt.installmentFrequency,
      nextInstallmentDate: debt.nextInstallmentDate ? debt.nextInstallmentDate.slice(0, 10) : "",
      notes: debt.notes ?? ""
    });
  }

  const selectedPerson = useMemo(
    () =>
      selectedDebt?.kind === "person"
        ? payload?.people.find((item) => item.id === selectedDebt.id) ?? null
        : null,
    [payload?.people, selectedDebt]
  );

  const selectedCompany = useMemo(
    () =>
      selectedDebt?.kind === "company"
        ? payload?.companies.find((item) => item.id === selectedDebt.id) ?? null
        : null,
    [payload?.companies, selectedDebt]
  );
  const selectedDetailStartLabel = selectedPerson
    ? formatDate(selectedPerson.startDate)
    : selectedCompany
      ? "Generada desde reembolsos"
      : "N/A";
  const selectedDetailEstimatedLabel = selectedPerson?.estimatedPayDate
    ? formatDate(selectedPerson.estimatedPayDate)
    : selectedCompany
      ? "No aplica"
      : "Sin fecha estimada";
  const selectedInstallmentLabel = selectedPerson?.isInstallmentDebt
    ? `${selectedPerson.paidInstallments}/${selectedPerson.installmentCount}`
    : "Pago único";
  const selectedInstallmentFrequencyLabel = selectedPerson
    ? installmentFrequencyLabel[selectedPerson.installmentFrequency]
    : "Mensual";
  const selectedInstallmentNextLabel = selectedPerson?.isInstallmentDebt
    ? selectedPerson.nextInstallmentDate
      ? formatDate(selectedPerson.nextInstallmentDate)
      : "Sin próxima fecha"
    : "No aplica";

  async function exportDebt(debt: SelectedDebt) {
    setExportingDebt(debt.id);
    setError(null);
    try {
      const response = await fetch(`/api/debts/${debt.id}/export?kind=${debt.kind}`, {
        cache: "no-store"
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "No se pudo exportar la deuda.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = response.headers.get("Content-Disposition")?.match(/filename=\"?([^"]+)\"?/)?.[1] ?? "deuda.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setMessage("PDF generado correctamente.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "No se pudo exportar la deuda.");
    } finally {
      setExportingDebt(null);
    }
  }

  async function settleDebt(debt: SelectedDebt) {
    setSettlingDebt(debt.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/debts/${debt.id}/settle?kind=${debt.kind}`, {
        method: "POST"
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "No se pudo cerrar la deuda.");
      }
      setMessage("Deuda marcada como pagada.");
      await loadDebts();
    } catch (settleError) {
      setError(settleError instanceof Error ? settleError.message : "No se pudo cerrar la deuda.");
    } finally {
      setSettlingDebt(null);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <SectionHeader
        eyebrow="Pendientes"
        title="Deudas y abonos"
        description="Controla empresas y personas que te deben dinero con una vista clara y accionable."
        actions={
          <StatPill tone="warning" icon={<Users className="h-3.5 w-3.5" />}>
            {payload ? payload.totals.pendingTotal > 0 ? "Con saldo pendiente" : "Sin pendientes" : "Cargando"}
          </StatPill>
        }
      />

      <SurfaceCard variant="highlight" padding="sm" className="animate-fade-up">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={tab === "empresas" ? "default" : "secondary"}
            onClick={() => setTab("empresas")}
            className="tap-feedback h-10"
          >
            Empresas
          </Button>
          <Button
            variant={tab === "personas" ? "default" : "secondary"}
            onClick={() => setTab("personas")}
            className="tap-feedback h-10"
          >
            Personas / tarjetas prestadas
          </Button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Button variant="secondary" className="tap-feedback" onClick={() => setFormMode("nueva")}>
            Registrar deuda
          </Button>
          <Button variant="secondary" className="tap-feedback" onClick={() => setFormMode("abono")}>
            Registrar abono
          </Button>
          <Button variant="secondary" className="tap-feedback" onClick={() => setFormMode("none")}>
            Ver saldo pendiente
          </Button>
        </div>
      </SurfaceCard>

      {error ? (
        <ErrorStateCard
          title="No se pudieron cargar las deudas"
          details={error}
          onRetry={() => window.location.reload()}
        />
      ) : null}
      {message ? (
        <SurfaceCard
          variant="soft"
          padding="sm"
          className="border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
        >
          <p className="text-sm font-medium">{message}</p>
        </SurfaceCard>
      ) : null}

      <MobileStickyAction type="button" onClick={() => setFormMode("nueva")} className="tap-feedback">
        Registrar deuda
      </MobileStickyAction>

      {selectedDebt ? (
        <SurfaceCard className="overflow-hidden rounded-[28px] border border-white/80 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-4 text-white shadow-[0_22px_48px_rgba(15,23,42,0.18)] animate-fade-up">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
                {selectedDebt.kind === "person" ? "Deuda personal" : "Deuda empresarial"}
              </p>
              <h3 className="text-2xl font-semibold tracking-tight">
                {selectedPerson?.name ?? selectedCompany?.name ?? "Detalle de deuda"}
              </h3>
              <p className="max-w-2xl text-sm text-white/70">
                {selectedPerson?.reason ?? selectedCompany?.reason ?? "Revisar detalle y acciones disponibles."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="tap-feedback h-10 rounded-2xl bg-white/10 text-white hover:bg-white/20"
                onClick={() => exportDebt(selectedDebt)}
                disabled={exportingDebt === selectedDebt.id}
              >
                {exportingDebt === selectedDebt.id ? (
                  "Exportando..."
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4 shrink-0" />
                    Exportar PDF
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="tap-feedback h-10 rounded-2xl bg-white/10 text-white hover:bg-white/20"
                onClick={() => settleDebt(selectedDebt)}
                disabled={settlingDebt === selectedDebt.id}
              >
                {settlingDebt === selectedDebt.id ? (
                  "Cerrando..."
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Marcar como pagada
                  </>
                )}
              </Button>
                {selectedDebt.kind === "person" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="tap-feedback h-10 rounded-2xl bg-white/10 text-white hover:bg-white/20"
                    onClick={() => setFormMode("editar")}
                  >
                    <PencilLine className="mr-2 h-4 w-4 shrink-0" />
                    Editar
                  </Button>
                ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[22px] bg-white/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Monto total</p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(selectedPerson?.totalAmount ?? selectedCompany?.totalAmount ?? 0)}</p>
            </div>
            <div className="rounded-[22px] bg-white/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Abonado</p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(selectedPerson?.paidAmount ?? selectedCompany?.paidAmount ?? 0)}</p>
            </div>
            <div className="rounded-[22px] bg-white/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Saldo pendiente</p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(selectedPerson?.pendingAmount ?? selectedCompany?.pendingAmount ?? 0)}</p>
            </div>
          </div>

          {selectedPerson?.isInstallmentDebt ? (
            <div className="mt-3 rounded-[24px] border border-white/10 bg-white/6 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Cuotas</p>
                  <p className="mt-1 text-sm text-white/70">Progreso {selectedInstallmentLabel} · Frecuencia {selectedInstallmentFrequencyLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Próxima cuota</p>
                  <p className="mt-1 text-sm font-medium text-white">{selectedInstallmentNextLabel}</p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.max(0, Math.min(100, selectedPerson.installmentProgress))}%` }}
                />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-[18px] bg-white/8 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Valor cuota</p>
                  <p className="mt-1 text-lg font-semibold">{formatCurrency(selectedPerson.installmentValue)}</p>
                </div>
                <div className="rounded-[18px] bg-white/8 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Cuotas pendientes</p>
                  <p className="mt-1 text-lg font-semibold">{selectedPerson.installmentsPending}</p>
                </div>
                <div className="rounded-[18px] bg-white/8 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Monto restante</p>
                  <p className="mt-1 text-lg font-semibold">{formatCurrency(selectedPerson.installmentRemainingAmount)}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-emerald-300" />
                <p className="text-sm font-semibold text-white">Cronología</p>
              </div>
              <div className="mt-3 space-y-2">
                {selectedPerson ? (
                  selectedPerson.payments.length === 0 ? (
                    <p className="text-sm text-white/60">Todavía no hay abonos registrados.</p>
                  ) : (
                    selectedPerson.payments.map((payment) => (
                      <div key={payment.id} className="rounded-[20px] bg-white/8 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{formatDate(payment.paidAt)}</p>
                          <p className="text-sm font-semibold text-emerald-300">{formatCurrency(payment.amount)}</p>
                        </div>
                        {payment.notes ? <p className="mt-1 text-xs text-white/60">{payment.notes}</p> : null}
                      </div>
                    ))
                  )
                ) : selectedCompany ? (
                  selectedCompany.entries.length === 0 ? (
                    <p className="text-sm text-white/60">No hay movimientos asociados.</p>
                  ) : (
                    selectedCompany.entries.map((entry) => (
                      <div key={entry.id} className="rounded-[20px] bg-white/8 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{formatDate(entry.createdAt)}</p>
                          <p className="text-sm font-semibold text-emerald-300">{formatCurrency(entry.amount)}</p>
                        </div>
                        <p className="mt-1 text-xs text-white/60">
                          {entry.status === "REEMBOLSADO" ? "Reembolsado" : "Pendiente"}
                          {entry.notes ? ` · ${entry.notes}` : ""}
                        </p>
                      </div>
                    ))
                  )
                ) : null}
              </div>
            </div>

              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Detalle rápido</p>
              <div className="mt-3 space-y-3 text-sm text-white/70">
                <p>Inicio: {selectedDetailStartLabel}</p>
                <p>Vencimiento estimado: {selectedDetailEstimatedLabel}</p>
                <p>
                  Estado: {selectedPerson?.status ?? selectedCompany?.status ?? "Sin estado"}
                </p>
                {selectedPerson?.isInstallmentDebt ? (
                  <>
                    <p>Cuotas: {selectedPerson.paidInstallments}/{selectedPerson.installmentCount}</p>
                    <p>Proxima cuota: {selectedInstallmentNextLabel}</p>
                    <p>Seguimiento: {selectedPerson.installmentStatusLabel}</p>
                  </>
                ) : null}
                {selectedPerson?.notes ? <p>Notas: {selectedPerson.notes}</p> : null}
              </div>
            </div>
          </div>
        </SurfaceCard>
      ) : null}

      {formMode === "nueva" ? (
        <SurfaceCard variant="highlight" className="space-y-4 animate-fade-up">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">Nueva deuda</p>
            <h3 className="text-base font-semibold tracking-tight text-slate-900">Registrar deuda</h3>
            <p className="text-sm text-slate-500">Completa el monto, la fecha y si aplica el plan de cuotas.</p>
          </div>
          <form className="mt-3 grid gap-2.5 sm:grid-cols-2" onSubmit={handleCreateDebt}>
            <label className="space-y-2">
              <span className={formFieldLabelClass}>Nombre</span>
              <Input placeholder="Nombre" value={createForm.name} onChange={(event) => setCreateForm((c) => ({ ...c, name: event.target.value }))} />
            </label>
            <label className="space-y-2">
              <span className={formFieldLabelClass}>Motivo</span>
              <Input placeholder="Motivo" value={createForm.reason} onChange={(event) => setCreateForm((c) => ({ ...c, reason: event.target.value }))} />
            </label>
            <label className="space-y-2">
              <span className={formFieldLabelClass}>Monto total</span>
              <Input type="number" placeholder="Monto total" value={createForm.totalAmount} onChange={(event) => setCreateForm((c) => ({ ...c, totalAmount: event.target.value }))} />
            </label>
            <label className="space-y-2">
              <span className={formFieldLabelClass}>Fecha de inicio</span>
              <Input type="date" value={createForm.startDate} onChange={(event) => setCreateForm((c) => ({ ...c, startDate: event.target.value }))} />
            </label>
            <label className="space-y-2">
              <span className={formFieldLabelClass}>Fecha estimada</span>
              <Input type="date" value={createForm.estimatedPayDate} onChange={(event) => setCreateForm((c) => ({ ...c, estimatedPayDate: event.target.value }))} />
            </label>
            <label className="space-y-2">
              <span className={formFieldLabelClass}>Modalidad</span>
              <Select
                value={createForm.isInstallmentDebt}
                onChange={(event) =>
                  setCreateForm((c) => ({
                    ...c,
                    isInstallmentDebt: event.target.value,
                    ...(event.target.value === "no"
                      ? {
                          installmentCount: "",
                          installmentValue: "",
                          paidInstallments: "",
                          nextInstallmentDate: ""
                        }
                      : {})
                  }))
                }
              >
                <option value="no">Pago único</option>
                <option value="si">En cuotas</option>
              </Select>
            </label>
            {createForm.isInstallmentDebt === "si" ? (
              <>
                <label className="space-y-2">
                  <span className={formFieldLabelClass}>Total de cuotas</span>
                  <Input
                  type="number"
                  placeholder="Total de cuotas"
                  value={createForm.installmentCount}
                  onChange={(event) => setCreateForm((c) => ({ ...c, installmentCount: event.target.value }))}
                />
                </label>
                <label className="space-y-2">
                  <span className={formFieldLabelClass}>Valor por cuota</span>
                  <Input
                  type="number"
                  placeholder="Valor por cuota"
                  value={createForm.installmentValue}
                  onChange={(event) => setCreateForm((c) => ({ ...c, installmentValue: event.target.value }))}
                />
                </label>
                <label className="space-y-2">
                  <span className={formFieldLabelClass}>Cuotas pagadas</span>
                  <Input
                  type="number"
                  placeholder="Cuotas pagadas"
                  value={createForm.paidInstallments}
                  onChange={(event) => setCreateForm((c) => ({ ...c, paidInstallments: event.target.value }))}
                />
                </label>
                <label className="space-y-2">
                  <span className={formFieldLabelClass}>Frecuencia</span>
                  <Select
                  value={createForm.installmentFrequency}
                  onChange={(event) => setCreateForm((c) => ({ ...c, installmentFrequency: event.target.value }))}
                >
                  <option value="MENSUAL">Mensual</option>
                  <option value="QUINCENAL">Quincenal</option>
                  <option value="SEMANAL">Semanal</option>
                  <option value="ANUAL">Anual</option>
                </Select>
                </label>
                <label className="space-y-2">
                  <span className={formFieldLabelClass}>Próxima cuota</span>
                  <Input
                  type="date"
                  value={createForm.nextInstallmentDate}
                  onChange={(event) => setCreateForm((c) => ({ ...c, nextInstallmentDate: event.target.value }))}
                />
                </label>
              </>
            ) : null}
            <label className="space-y-2 sm:col-span-2">
              <span className={formFieldLabelClass}>Observaciones</span>
              <textarea className={formTextareaClass} placeholder="Observaciones" value={createForm.notes} onChange={(event) => setCreateForm((c) => ({ ...c, notes: event.target.value }))} />
            </label>
            <div className="sm:col-span-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" className="tap-feedback rounded-2xl" onClick={() => setFormMode("none")}>
                Cancelar
              </Button>
              <Button type="submit" className="tap-feedback rounded-2xl" disabled={saving}>{saving ? "Guardando..." : "Guardar deuda"}</Button>
            </div>
          </form>
        </SurfaceCard>
      ) : null}

      {formMode === "abono" ? (
        <SurfaceCard variant="highlight" className="space-y-4 animate-fade-up">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">Nuevo abono</p>
            <h3 className="text-base font-semibold tracking-tight text-slate-900">Registrar abono</h3>
          </div>
          <form className="mt-3 grid gap-2.5 sm:grid-cols-2" onSubmit={handleCreatePayment}>
            <label className="space-y-2">
              <span className={formFieldLabelClass}>Deuda</span>
              <Select value={paymentForm.debtorId} onChange={(event) => setPaymentForm((c) => ({ ...c, debtorId: event.target.value }))}>
                <option value="">Selecciona deuda</option>
                {payload?.people.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </Select>
            </label>
            <label className="space-y-2">
              <span className={formFieldLabelClass}>Monto abonado</span>
              <Input type="number" placeholder="Monto abonado" value={paymentForm.amount} onChange={(event) => setPaymentForm((c) => ({ ...c, amount: event.target.value }))} />
            </label>
            <label className="space-y-2">
              <span className={formFieldLabelClass}>Fecha del abono</span>
              <Input type="date" value={paymentForm.paidAt} onChange={(event) => setPaymentForm((c) => ({ ...c, paidAt: event.target.value }))} />
            </label>
            <label className="space-y-2">
              <span className={formFieldLabelClass}>Observaciones</span>
              <Input placeholder="Observaciones" value={paymentForm.notes} onChange={(event) => setPaymentForm((c) => ({ ...c, notes: event.target.value }))} />
            </label>
            <div className="sm:col-span-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" className="tap-feedback rounded-2xl" onClick={() => setFormMode("none")}>
                Cancelar
              </Button>
              <Button type="submit" className="tap-feedback rounded-2xl" disabled={saving}>{saving ? "Guardando..." : "Guardar abono"}</Button>
            </div>
          </form>
        </SurfaceCard>
      ) : null}

      {formMode === "editar" && selectedDebtor ? (
        <SurfaceCard variant="highlight" className="space-y-4 animate-fade-up">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">Edición</p>
            <h3 className="text-base font-semibold tracking-tight text-slate-900">Editar deuda</h3>
          </div>
          <form className="mt-3 grid gap-2.5 sm:grid-cols-2" onSubmit={handleEditDebt}>
            <label className="space-y-2"><span className={formFieldLabelClass}>Nombre</span><Input value={editForm.name} onChange={(event) => setEditForm((c) => ({ ...c, name: event.target.value }))} /></label>
            <label className="space-y-2"><span className={formFieldLabelClass}>Motivo</span><Input value={editForm.reason} onChange={(event) => setEditForm((c) => ({ ...c, reason: event.target.value }))} /></label>
            <label className="space-y-2"><span className={formFieldLabelClass}>Monto total</span><Input type="number" value={editForm.totalAmount} onChange={(event) => setEditForm((c) => ({ ...c, totalAmount: event.target.value }))} /></label>
            <label className="space-y-2"><span className={formFieldLabelClass}>Estado</span><Select value={editForm.status} onChange={(event) => setEditForm((c) => ({ ...c, status: event.target.value }))}>
              <option value="PENDIENTE">Pendiente</option>
              <option value="ABONANDO">Abonando</option>
              <option value="PAGADO">Pagado</option>
              <option value="ATRASADO">Atrasado</option>
            </Select></label>
            <label className="space-y-2"><span className={formFieldLabelClass}>Fecha estimada</span><Input type="date" value={editForm.estimatedPayDate} onChange={(event) => setEditForm((c) => ({ ...c, estimatedPayDate: event.target.value }))} /></label>
            <label className="space-y-2"><span className={formFieldLabelClass}>Modalidad</span><Select
              value={editForm.isInstallmentDebt}
              onChange={(event) =>
                setEditForm((c) => ({
                  ...c,
                  isInstallmentDebt: event.target.value,
                  ...(event.target.value === "no"
                    ? {
                        installmentCount: "",
                        installmentValue: "",
                        paidInstallments: "",
                        nextInstallmentDate: ""
                      }
                    : {})
                }))
              }
            >
              <option value="no">Pago único</option>
              <option value="si">En cuotas</option>
            </Select></label>
            {editForm.isInstallmentDebt === "si" ? (
              <>
                <label className="space-y-2"><span className={formFieldLabelClass}>Total de cuotas</span><Input
                  type="number"
                  value={editForm.installmentCount}
                  onChange={(event) => setEditForm((c) => ({ ...c, installmentCount: event.target.value }))}
                  placeholder="Total de cuotas"
                /></label>
                <label className="space-y-2"><span className={formFieldLabelClass}>Valor por cuota</span><Input
                  type="number"
                  value={editForm.installmentValue}
                  onChange={(event) => setEditForm((c) => ({ ...c, installmentValue: event.target.value }))}
                  placeholder="Valor por cuota"
                /></label>
                <label className="space-y-2"><span className={formFieldLabelClass}>Cuotas pagadas</span><Input
                  type="number"
                  value={editForm.paidInstallments}
                  onChange={(event) => setEditForm((c) => ({ ...c, paidInstallments: event.target.value }))}
                  placeholder="Cuotas pagadas"
                /></label>
                <label className="space-y-2"><span className={formFieldLabelClass}>Frecuencia</span><Select
                  value={editForm.installmentFrequency}
                  onChange={(event) => setEditForm((c) => ({ ...c, installmentFrequency: event.target.value }))}
                >
                  <option value="MENSUAL">Mensual</option>
                  <option value="QUINCENAL">Quincenal</option>
                  <option value="SEMANAL">Semanal</option>
                  <option value="ANUAL">Anual</option>
                </Select></label>
                <label className="space-y-2"><span className={formFieldLabelClass}>Próxima cuota</span><Input
                  type="date"
                  value={editForm.nextInstallmentDate}
                  onChange={(event) => setEditForm((c) => ({ ...c, nextInstallmentDate: event.target.value }))}
                  placeholder="Próxima cuota"
                /></label>
              </>
            ) : null}
            <label className="space-y-2 sm:col-span-2"><span className={formFieldLabelClass}>Observaciones</span><textarea className={formTextareaClass} value={editForm.notes} onChange={(event) => setEditForm((c) => ({ ...c, notes: event.target.value }))} placeholder="Observaciones" /></label>
            <div className="sm:col-span-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" className="tap-feedback rounded-2xl" onClick={() => setFormMode("none")}>
                Cancelar
              </Button>
              <Button type="submit" className="tap-feedback rounded-2xl" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
            </div>
          </form>
        </SurfaceCard>
      ) : null}

      {loading ? <SkeletonCard lines={4} /> : null}

      {!loading && payload ? (
        <SurfaceCard variant="soft" className="space-y-4">
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-muted/60 px-3 py-2">
              <p className="text-xs text-neutral-500">Pendiente empresas</p>
              <p className="text-sm font-semibold">{formatCurrency(payload.totals.pendingCompanies)}</p>
            </div>
            <div className="rounded-xl bg-muted/60 px-3 py-2">
              <p className="text-xs text-neutral-500">Pendiente personas</p>
              <p className="text-sm font-semibold">{formatCurrency(payload.totals.pendingPeople)}</p>
            </div>
            <div className="rounded-xl bg-muted/60 px-3 py-2">
              <p className="text-xs text-neutral-500">Pendiente total</p>
              <p className="text-sm font-semibold">{formatCurrency(payload.totals.pendingTotal)}</p>
            </div>
          </div>

          {payload.commitments.activeInstallmentDebts > 0 ? (
            <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[20px] border border-violet-100 bg-violet-50/60 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-violet-500">Compromisos del mes</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {formatCurrency(payload.commitments.monthlyCommittedTotal)}
                  </p>
                </div>
                <div className="rounded-[20px] border border-amber-100 bg-amber-50/60 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-amber-500">Proximos vencimientos</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {payload.commitments.upcomingCount}
                  </p>
                </div>
                <div className="rounded-[20px] border border-rose-100 bg-rose-50/60 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-rose-500">Cuotas vencidas</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {payload.commitments.overdueCount}
                  </p>
                </div>
                <div className="rounded-[20px] border border-emerald-100 bg-emerald-50/60 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-500">Deudas activas</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {payload.commitments.activeInstallmentDebts}
                  </p>
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Timeline de vencimientos
                </p>
                <div className="mt-3 space-y-2">
                  {payload.commitments.upcomingTimeline.map((entry) => (
                    <button
                      key={`${entry.debtId}-${entry.dueDate}`}
                      type="button"
                      onClick={() => setSelectedDebt({ kind: "person", id: entry.debtId })}
                    className="tap-feedback interactive-lift flex w-full items-center justify-between rounded-[18px] border border-white bg-white/90 px-3 py-3 text-left hover:border-violet-200"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{entry.debtName}</p>
                        <p className="text-[11px] text-slate-500">
                          {formatDate(entry.dueDate)} · {entry.reason}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${installmentTone[entry.health].chip}`}
                        >
                          {entry.health === "VENCIDA"
                            ? "Vencida"
                            : entry.health === "PROXIMA"
                              ? "Proxima"
                              : entry.health === "PAGADA"
                                ? "Pagada"
                                : "Al dia"}
                        </span>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatCurrency(entry.amount)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "empresas" ? (
            <div className="space-y-2">
              {payload.companies.length === 0 ? (
                <EmptyStateCard
                  icon={CreditCard}
                  title="Sin deudas de empresas"
                  description="Registra un gasto empresarial pagado por ti para que aparezca aqui."
                />
              ) : (
                payload.companies.map((item) => (
                  <div
                    key={item.id}
                    className={`interactive-lift rounded-[24px] border px-4 py-4 shadow-soft animate-fade-up ${
                      selectedDebt?.kind === "company" && selectedDebt.id === item.id
                        ? "border-violet-300 bg-violet-50/60"
                        : "border-border/70 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="text-xs text-neutral-500">{item.reason}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-700">
                        {item.status === "PAGADO" ? "Pagado" : item.status === "ABONANDO" ? "Abonando" : "Pendiente"}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-1 text-xs text-neutral-600 sm:grid-cols-3">
                      <p>Total: {formatCurrency(item.totalAmount)}</p>
                      <p>Abonado: {formatCurrency(item.paidAmount)}</p>
                      <p>Saldo: {formatCurrency(item.pendingAmount)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        className="tap-feedback h-8 rounded-2xl px-3 text-xs"
                        onClick={() => setSelectedDebt({ kind: "company", id: item.id })}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Ver detalle
                      </Button>
                      <Button
                        variant="secondary"
                        className="tap-feedback h-8 rounded-2xl px-3 text-xs"
                        onClick={() => exportDebt({ kind: "company", id: item.id })}
                        disabled={exportingDebt === item.id}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Exportar PDF
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {payload.people.length === 0 ? (
                <EmptyStateCard
                  icon={Users}
                  title="Sin deudas de personas"
                  description="Registra una deuda de persona o tarjeta prestada para verla aqui."
                />
              ) : (
                payload.people.map((item) => (
                  <div
                    key={item.id}
                    className={`interactive-lift rounded-[24px] border px-4 py-4 shadow-soft animate-fade-up ${
                      selectedDebt?.kind === "person" && selectedDebt.id === item.id
                        ? "border-violet-300 bg-violet-50/60"
                        : "border-border/70 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="text-xs text-neutral-500">{item.reason}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-700">
                        {statusLabel[item.status]}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-neutral-600 sm:grid-cols-3">
                      <p>Total: {formatCurrency(item.totalAmount)}</p>
                      <p>Abonado: {formatCurrency(item.paidAmount)}</p>
                      <p>Saldo: {formatCurrency(item.pendingAmount)}</p>
                    </div>
                    <div className="mt-3 rounded-[18px] bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                          {item.isInstallmentDebt ? "Cuotas" : "Modalidad"}
                        </p>
                        <div className="flex items-center gap-2">
                          {item.isInstallmentDebt ? (
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${installmentTone[item.installmentStatus].chip}`}
                            >
                              {item.installmentStatusLabel}
                            </span>
                          ) : null}
                          <p className="text-xs font-medium text-neutral-600">
                            {item.isInstallmentDebt ? `${item.paidInstallments}/${item.installmentCount}` : "Pago único"}
                          </p>
                        </div>
                      </div>
                      {item.isInstallmentDebt ? (
                        <>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ease-out ${installmentTone[item.installmentStatus].bar}`}
                              style={{ width: `${Math.max(0, Math.min(100, item.installmentProgress))}%` }}
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
                            <span>Cuota: {formatCurrency(item.installmentValue)}</span>
                            <span>{relativeInstallmentText(item.installmentDaysUntilDue)}</span>
                          </div>
                        </>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      Inicio: {formatDate(item.startDate)} {item.estimatedPayDate ? `· Estimado: ${formatDate(item.estimatedPayDate)}` : ""}{" "}
                      {item.isInstallmentDebt && item.nextInstallmentDate ? `· Próxima: ${formatDate(item.nextInstallmentDate)}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionButton
                        icon={Eye}
                        tone="neutral"
                        className="h-8 px-3 text-xs"
                        onClick={() => setSelectedDebt({ kind: "person", id: item.id })}
                      >
                        Ver detalle
                      </ActionButton>
                      <ActionButton
                        tone="premium"
                        className="h-8 px-3 text-xs"
                        onClick={() => {
                          setFormMode("abono");
                          setPaymentForm((current) => ({ ...current, debtorId: item.id }));
                        }}
                      >
                        Registrar abono
                      </ActionButton>
                      <ActionButton
                        icon={PencilLine}
                        tone="neutral"
                        className="h-8 px-3 text-xs"
                        onClick={() => openEdit(item)}
                      >
                        Editar
                      </ActionButton>
                      <ActionButton
                        icon={Download}
                        tone="neutral"
                        className="h-8 px-3 text-xs"
                        loading={exportingDebt === item.id}
                        onClick={() => exportDebt({ kind: "person", id: item.id })}
                      >
                        Exportar PDF
                      </ActionButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </SurfaceCard>
      ) : null}
    </div>
  );
}
