"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Eye, PencilLine, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
};

const statusLabel: Record<PersonDebt["status"], string> = {
  PENDIENTE: "Pendiente",
  ABONANDO: "Abonando",
  PAGADO: "Pagado",
  ATRASADO: "Atrasado"
};

function todayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
          estimatedPayDate: createForm.estimatedPayDate || null,
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
          estimatedPayDate: editForm.estimatedPayDate || null,
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
    <div className="space-y-4 sm:space-y-5">
      <Card className="rounded-[24px] p-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={tab === "empresas" ? "default" : "secondary"}
            onClick={() => setTab("empresas")}
            className="h-9"
          >
            Empresas
          </Button>
          <Button
            variant={tab === "personas" ? "default" : "secondary"}
            onClick={() => setTab("personas")}
            className="h-9"
          >
            Personas / tarjetas prestadas
          </Button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Button variant="secondary" onClick={() => setFormMode("nueva")}>
            Registrar deuda
          </Button>
          <Button variant="secondary" onClick={() => setFormMode("abono")}>
            Registrar abono
          </Button>
          <Button variant="secondary" onClick={() => setFormMode("none")}>
            Ver saldo pendiente
          </Button>
        </div>
      </Card>

      {error ? <Card className="rounded-[20px] border border-rose-100 bg-rose-50/70 p-3 text-sm text-rose-700">{error}</Card> : null}
      {message ? <Card className="rounded-[20px] border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-emerald-700">{message}</Card> : null}

      {selectedDebt ? (
        <Card className="overflow-hidden rounded-[28px] border border-white/80 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-4 text-white shadow-[0_22px_48px_rgba(15,23,42,0.18)]">
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
                className="h-10 rounded-2xl bg-white/10 text-white hover:bg-white/20"
                onClick={() => exportDebt(selectedDebt)}
                disabled={exportingDebt === selectedDebt.id}
              >
                {exportingDebt === selectedDebt.id ? (
                  "Exportando..."
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar PDF
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-2xl bg-white/10 text-white hover:bg-white/20"
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
                  className="h-10 rounded-2xl bg-white/10 text-white hover:bg-white/20"
                  onClick={() => setFormMode("editar")}
                >
                  <PencilLine className="mr-2 h-4 w-4" />
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
                {selectedPerson?.notes ? <p>Notas: {selectedPerson.notes}</p> : null}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {formMode === "nueva" ? (
        <Card className="rounded-[24px] p-4">
          <h3 className="text-base font-semibold">Registrar deuda</h3>
          <form className="mt-3 grid gap-2.5 sm:grid-cols-2" onSubmit={handleCreateDebt}>
            <Input placeholder="Nombre" value={createForm.name} onChange={(event) => setCreateForm((c) => ({ ...c, name: event.target.value }))} />
            <Input placeholder="Motivo" value={createForm.reason} onChange={(event) => setCreateForm((c) => ({ ...c, reason: event.target.value }))} />
            <Input type="number" placeholder="Monto total" value={createForm.totalAmount} onChange={(event) => setCreateForm((c) => ({ ...c, totalAmount: event.target.value }))} />
            <Input type="date" value={createForm.startDate} onChange={(event) => setCreateForm((c) => ({ ...c, startDate: event.target.value }))} />
            <Input type="date" value={createForm.estimatedPayDate} onChange={(event) => setCreateForm((c) => ({ ...c, estimatedPayDate: event.target.value }))} />
            <Input placeholder="Observaciones" value={createForm.notes} onChange={(event) => setCreateForm((c) => ({ ...c, notes: event.target.value }))} />
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar deuda"}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {formMode === "abono" ? (
        <Card className="rounded-[24px] p-4">
          <h3 className="text-base font-semibold">Registrar abono</h3>
          <form className="mt-3 grid gap-2.5 sm:grid-cols-2" onSubmit={handleCreatePayment}>
            <Select value={paymentForm.debtorId} onChange={(event) => setPaymentForm((c) => ({ ...c, debtorId: event.target.value }))}>
              <option value="">Selecciona deuda</option>
              {payload?.people.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </Select>
            <Input type="number" placeholder="Monto abonado" value={paymentForm.amount} onChange={(event) => setPaymentForm((c) => ({ ...c, amount: event.target.value }))} />
            <Input type="date" value={paymentForm.paidAt} onChange={(event) => setPaymentForm((c) => ({ ...c, paidAt: event.target.value }))} />
            <Input placeholder="Observaciones" value={paymentForm.notes} onChange={(event) => setPaymentForm((c) => ({ ...c, notes: event.target.value }))} />
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar abono"}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {formMode === "editar" && selectedDebtor ? (
        <Card className="rounded-[24px] p-4">
          <h3 className="text-base font-semibold">Editar deuda</h3>
          <form className="mt-3 grid gap-2.5 sm:grid-cols-2" onSubmit={handleEditDebt}>
            <Input value={editForm.name} onChange={(event) => setEditForm((c) => ({ ...c, name: event.target.value }))} />
            <Input value={editForm.reason} onChange={(event) => setEditForm((c) => ({ ...c, reason: event.target.value }))} />
            <Input type="number" value={editForm.totalAmount} onChange={(event) => setEditForm((c) => ({ ...c, totalAmount: event.target.value }))} />
            <Select value={editForm.status} onChange={(event) => setEditForm((c) => ({ ...c, status: event.target.value }))}>
              <option value="PENDIENTE">Pendiente</option>
              <option value="ABONANDO">Abonando</option>
              <option value="PAGADO">Pagado</option>
              <option value="ATRASADO">Atrasado</option>
            </Select>
            <Input type="date" value={editForm.estimatedPayDate} onChange={(event) => setEditForm((c) => ({ ...c, estimatedPayDate: event.target.value }))} />
            <Input value={editForm.notes} onChange={(event) => setEditForm((c) => ({ ...c, notes: event.target.value }))} placeholder="Observaciones" />
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {loading ? (
        <Card className="rounded-[24px] p-4 text-sm text-neutral-500">Cargando deudas...</Card>
      ) : null}

      {!loading && payload ? (
        <Card className="rounded-[24px] p-4">
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

          {tab === "empresas" ? (
            <div className="space-y-2">
              {payload.companies.length === 0 ? (
                <p className="text-sm text-neutral-500">No hay deudas de empresas registradas.</p>
              ) : (
                payload.companies.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-[24px] border px-4 py-4 shadow-soft transition ${
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
                        className="h-8 rounded-2xl px-3 text-xs"
                        onClick={() => setSelectedDebt({ kind: "company", id: item.id })}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Ver detalle
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-8 rounded-2xl px-3 text-xs"
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
                <p className="text-sm text-neutral-500">No hay personas con deuda registrada.</p>
              ) : (
                payload.people.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-[24px] border px-4 py-4 shadow-soft transition ${
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
                    <p className="mt-1 text-[11px] text-neutral-500">
                      Inicio: {formatDate(item.startDate)} {item.estimatedPayDate ? `· Estimado: ${formatDate(item.estimatedPayDate)}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        className="h-8 rounded-2xl px-3 text-xs"
                        onClick={() => setSelectedDebt({ kind: "person", id: item.id })}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Ver detalle
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-8 rounded-2xl px-3 text-xs"
                        onClick={() => {
                          setFormMode("abono");
                          setPaymentForm((current) => ({ ...current, debtorId: item.id }));
                        }}
                      >
                        Registrar abono
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-8 rounded-2xl px-3 text-xs"
                        onClick={() => openEdit(item)}
                      >
                        <PencilLine className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-8 rounded-2xl px-3 text-xs"
                        onClick={() => exportDebt({ kind: "person", id: item.id })}
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
          )}
        </Card>
      ) : null}
    </div>
  );
}
