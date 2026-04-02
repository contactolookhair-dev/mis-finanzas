"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyStateCard, ErrorStateCard, SkeletonCard } from "@/components/ui/states";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { SectionHeader } from "@/components/ui/section-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { StatPill } from "@/components/ui/stat-pill";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";

type LoanItem = {
  id: string;
  loanType: "lent" | "borrowed";
  counterpartyType: "person" | "company" | "custom";
  counterpartyName: string;
  amountTotal: number;
  amountPaid: number;
  amountPending: number;
  startDate: string;
  dueDate: string | null;
  status: "active" | "paid" | "overdue";
  description: string | null;
  hasInterest: boolean;
  interestType: string | null;
  interestValue: number | null;
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    notes: string | null;
  }>;
};

type ActiveTab = "lent" | "borrowed";

function safeYmd(value: string) {
  const trimmed = `${value ?? ""}`.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

function safeFormatDate(value: string | null) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return "—";
    return formatDate(value);
  } catch {
    return "—";
  }
}

function toneForStatus(status: LoanItem["status"]) {
  if (status === "paid") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  if (status === "overdue") return "bg-rose-50 text-rose-700 ring-1 ring-rose-100";
  return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
}

export function PrestamosClient() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("lent");
  const [items, setItems] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    loanType: "lent" as ActiveTab,
    counterpartyName: "",
    amountTotal: "",
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    description: ""
  });

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentLoanId, setPaymentLoanId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paidAt: new Date().toISOString().slice(0, 10),
    notes: ""
  });

  const summary = useMemo(() => {
    const lent = items.filter((i) => i.loanType === "lent");
    const borrowed = items.filter((i) => i.loanType === "borrowed");
    const totalLent = lent.reduce((acc, i) => acc + Math.max(0, i.amountTotal), 0);
    const totalBorrowed = borrowed.reduce((acc, i) => acc + Math.max(0, i.amountTotal), 0);
    const pendingCollect = lent.reduce((acc, i) => acc + Math.max(0, i.amountPending), 0);
    const pendingPay = borrowed.reduce((acc, i) => acc + Math.max(0, i.amountPending), 0);
    return { totalLent, totalBorrowed, pendingCollect, pendingPay };
  }, [items]);

  const visibleItems = useMemo(
    () => items.filter((i) => i.loanType === activeTab),
    [items, activeTab]
  );

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/loans", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "No se pudieron cargar los préstamos.");
      }
      const payload = (await response.json()) as { items?: LoanItem[] };
      setItems(payload.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los préstamos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createLoan() {
    const amountTotal = Number(form.amountTotal || 0);
    if (!form.counterpartyName.trim()) return;
    if (!Number.isFinite(amountTotal) || amountTotal <= 0) return;
    const startDate = safeYmd(form.startDate) || new Date().toISOString().slice(0, 10);
    const dueDate = safeYmd(form.dueDate);
    try {
      setSaving(true);
      const response = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanType: form.loanType,
          counterpartyType: "custom",
          counterpartyName: form.counterpartyName.trim(),
          amountTotal,
          startDate,
          dueDate: dueDate || null,
          description: form.description.trim() ? form.description.trim() : null
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "No se pudo crear el préstamo.");
      setCreateOpen(false);
      setForm({
        loanType: "lent",
        counterpartyName: "",
        amountTotal: "",
        startDate: new Date().toISOString().slice(0, 10),
        dueDate: "",
        description: ""
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el préstamo.");
    } finally {
      setSaving(false);
    }
  }

  async function addPayment() {
    if (!paymentLoanId) return;
    const amount = Number(paymentForm.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const paidAt = safeYmd(paymentForm.paidAt) || new Date().toISOString().slice(0, 10);
    try {
      setSaving(true);
      const response = await fetch(`/api/loans/${paymentLoanId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          paidAt,
          notes: paymentForm.notes.trim() ? paymentForm.notes.trim() : null
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "No se pudo registrar el abono.");
      setPaymentOpen(false);
      setPaymentLoanId(null);
      setPaymentForm({ amount: "", paidAt: new Date().toISOString().slice(0, 10), notes: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el abono.");
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(item: LoanItem) {
    const remaining = Math.max(0, item.amountPending);
    if (remaining <= 0) return;
    setPaymentLoanId(item.id);
    setPaymentForm({
      amount: `${remaining}`,
      paidAt: new Date().toISOString().slice(0, 10),
      notes: "Cierre total"
    });
    setPaymentOpen(true);
  }

  async function deleteLoan(id: string) {
    const ok = window.confirm("Eliminar este préstamo? Esto no afecta tus movimientos.");
    if (!ok) return;
    try {
      setSaving(true);
      const response = await fetch(`/api/loans/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "No se pudo eliminar el préstamo.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el préstamo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer className="space-y-6">
      <SectionHeader
        title="Préstamos"
        description="Registra dinero prestado y recibido. Se refleja en Pendientes sin mezclarlo con tarjetas."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <SurfaceCard className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Total que presté
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
            {formatCurrency(summary.totalLent)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Pendiente por cobrar:{" "}
            <span className="font-semibold text-slate-900">{formatCurrency(summary.pendingCollect)}</span>
          </p>
        </SurfaceCard>
        <SurfaceCard className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Total que me prestaron
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
            {formatCurrency(summary.totalBorrowed)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Pendiente por pagar:{" "}
            <span className="font-semibold text-slate-900">{formatCurrency(summary.pendingPay)}</span>
          </p>
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-2 sm:p-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={activeTab === "lent" ? "default" : "secondary"}
            className="h-10 flex-1 rounded-2xl text-sm"
            onClick={() => setActiveTab("lent")}
          >
            Presté dinero
          </Button>
          <Button
            type="button"
            variant={activeTab === "borrowed" ? "default" : "secondary"}
            className="h-10 flex-1 rounded-2xl text-sm"
            onClick={() => setActiveTab("borrowed")}
          >
            Me prestaron dinero
          </Button>
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
              {activeTab === "lent" ? "Presté dinero" : "Me prestaron dinero"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {activeTab === "lent"
                ? "Plata que te deben."
                : "Plata que tú debes pagar."}
            </p>
          </div>
          <Button
            type="button"
            variant="default"
            className="h-10 rounded-2xl px-4 text-sm"
            onClick={() => {
              setError(null);
              setForm((f) => ({ ...f, loanType: activeTab }));
              setCreateOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo
          </Button>
        </div>

        {loading ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <div className="mt-4">
            <ErrorStateCard title="No se pudieron cargar los préstamos" description={error} onRetry={() => void load()} />
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="mt-4">
            <EmptyStateCard
              title="Aún no tienes préstamos"
              description="Crea un préstamo para registrarlo y hacer seguimiento de abonos."
              actionLabel="Nuevo préstamo"
              onAction={() => setCreateOpen(true)}
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {visibleItems.map((item) => {
              const chip = toneForStatus(item.status);
              const total = Math.max(0, item.amountTotal);
              const paid = Math.max(0, item.amountPaid);
              const pending = Math.max(0, item.amountPending);
              const progressPct = total > 0 ? Math.max(0, Math.min(100, (paid / total) * 100)) : 0;
              const title = item.counterpartyName;
              const secondary = item.description ?? (activeTab === "lent" ? "Préstamo otorgado" : "Préstamo recibido");

              return (
                <SurfaceCard key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold tracking-[-0.02em] text-slate-900">
                        {title}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-600">{secondary}</p>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold", chip)}>
                      {item.status === "paid" ? "Pagado" : item.status === "overdue" ? "Vencido" : "Activo"}
                    </span>
                  </div>

                  <div className="mt-3 rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Total</p>
                        <p className="mt-1 font-semibold text-slate-900">{formatCurrency(total)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pagado</p>
                        <p className="mt-1 font-semibold text-emerald-700">{formatCurrency(paid)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pendiente</p>
                        <p className="mt-1 font-semibold text-rose-700">{formatCurrency(pending)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Progreso</p>
                        <p className="mt-1 font-semibold text-slate-900">{Math.round(progressPct)}%</p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={cn("h-full rounded-full", progressPct >= 100 ? "bg-emerald-500" : "bg-slate-900")}
                        style={{ width: `${Math.round(progressPct)}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>Inicio: {safeFormatDate(item.startDate)}</span>
                      {item.dueDate ? <span>· Vence: {safeFormatDate(item.dueDate)}</span> : null}
                      {item.hasInterest ? <StatPill tone="warning">Interés</StatPill> : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="default"
                      className="h-9 rounded-2xl px-3 text-sm"
                      onClick={() => {
                        setPaymentLoanId(item.id);
                        setPaymentForm({ amount: "", paidAt: new Date().toISOString().slice(0, 10), notes: "" });
                        setPaymentOpen(true);
                      }}
                    >
                      Registrar abono
                    </Button>
                    {pending > 0 ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-9 rounded-2xl px-3 text-sm"
                        onClick={() => void markPaid(item)}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Marcar pagado
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 rounded-2xl px-3 text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => void deleteLoan(item.id)}
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
      </SurfaceCard>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/45"
            onClick={() => setCreateOpen(false)}
          />
          <SurfaceCard className="relative w-full max-w-lg bg-white/95 p-5 ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                  Nuevo préstamo
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Se reflejará automáticamente en Pendientes.
                </p>
              </div>
              <Button type="button" variant="secondary" className="h-9 rounded-2xl" onClick={() => setCreateOpen(false)}>
                Cerrar
              </Button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tipo</span>
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                  {(["lent", "borrowed"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, loanType: value }))}
                      className={cn(
                        "tap-feedback h-10 rounded-xl text-xs font-semibold transition",
                        form.loanType === value
                          ? "bg-white text-slate-900 shadow-[0_8px_16px_rgba(15,23,42,0.12)]"
                          : "text-slate-500"
                      )}
                    >
                      {value === "lent" ? "Presté dinero" : "Me prestaron"}
                    </button>
                  ))}
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Nombre</span>
                <Input
                  value={form.counterpartyName}
                  onChange={(e) => setForm((f) => ({ ...f, counterpartyName: e.target.value }))}
                  placeholder="Ej: Sebastián, House of Hair..."
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Monto</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={form.amountTotal}
                    onChange={(e) => setForm((f) => ({ ...f, amountTotal: e.target.value }))}
                    placeholder="Ej: 120000"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Inicio</span>
                  <Input
                    type="date"
                    value={safeYmd(form.startDate)}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                </label>
              </div>

                <label className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Vencimiento (opcional)</span>
                <Input
                  type="date"
                  value={safeYmd(form.dueDate)}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </label>

              <label className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Descripción</span>
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Opcional" />
              </label>

              <Button
                type="button"
                variant="default"
                className="h-11 rounded-2xl"
                disabled={saving}
                onClick={() => void createLoan()}
              >
                {saving ? "Guardando..." : "Crear préstamo"}
              </Button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {paymentOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/45"
            onClick={() => setPaymentOpen(false)}
          />
          <SurfaceCard className="relative w-full max-w-lg bg-white/95 p-5 ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                  Registrar abono
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Se recalcula pagado/pendiente automáticamente.
                </p>
              </div>
              <Button type="button" variant="secondary" className="h-9 rounded-2xl" onClick={() => setPaymentOpen(false)}>
                Cerrar
              </Button>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Monto</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="Ej: 50000"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Fecha</span>
                  <Input
                    type="date"
                    value={safeYmd(paymentForm.paidAt)}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, paidAt: e.target.value }))}
                  />
                </label>
              </div>
              <label className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Notas</span>
                <Input value={paymentForm.notes} onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
              </label>
              <Button
                type="button"
                variant="default"
                className="h-11 rounded-2xl"
                disabled={saving}
                onClick={() => void addPayment()}
              >
                {saving ? "Guardando..." : "Registrar abono"}
              </Button>
            </div>
          </SurfaceCard>
        </div>
      ) : null}
    </PageContainer>
  );
}
