"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Skeleton } from "@/components/ui/states";
import { StatPill } from "@/components/ui/stat-pill";
import { resolveAccountAppearance } from "@/lib/accounts/account-appearance";
import type { DashboardSnapshot } from "@/shared/types/dashboard";

type AccountItem = {
  id: string;
  name: string;
  bank: string;
  type: "CREDITO" | "DEBITO" | "EFECTIVO";
  balance: number;
  color: string | null;
  icon: string | null;
  appearanceMode: "auto" | "manual";
};

type CategoryItem = {
  id: string;
  name: string;
};

type DebtorPerson = {
  id: string;
  name: string;
  totalAmount: number;
  notes: string | null;
};

type AccountsPayload = { items: AccountItem[] };
type CategoriesPayload = { items: CategoryItem[] };
type DebtsPayload = { people: DebtorPerson[] };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

type TransactionKind = "GASTO" | "INGRESO" | "TRANSFERENCIA";
const QUICK_PREFS_KEY = "mis-finanzas.quick-transaction";

type QuickPrefs = {
  kind?: TransactionKind;
  accountId?: string;
  categoryId?: string;
};

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500";
const textareaClass =
  "min-h-[92px] w-full rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-sm outline-none focus:border-violet-400";

export function NewTransactionModal({ open, onOpenChange, onSuccess }: Props) {
  const [kind, setKind] = useState<TransactionKind>("GASTO");
  const [classification, setClassification] = useState<"PERSONAL" | "NEGOCIO" | "PRESTADO">("PERSONAL");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getToday());
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [isOwed, setIsOwed] = useState(false);
  const [owedByType, setOwedByType] = useState<"PERSONA" | "EMPRESA">("PERSONA");
  const [owedBusinessUnitId, setOwedBusinessUnitId] = useState("");
  const [owedDebtorMode, setOwedDebtorMode] = useState<"EXISTING" | "NEW">("NEW");
  const [owedDebtorId, setOwedDebtorId] = useState("");
  const [owedDebtorName, setOwedDebtorName] = useState("");
  const [owedAmount, setOwedAmount] = useState("");
  const [owedNote, setOwedNote] = useState("");
  const [installmentsEnabled, setInstallmentsEnabled] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("");
  const [installmentValue, setInstallmentValue] = useState("");
  const [nextInstallmentDate, setNextInstallmentDate] = useState("");

  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [debtors, setDebtors] = useState<DebtorPerson[]>([]);
  const [dashboardSnapshot, setDashboardSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedAmount = useMemo(() => Number(amount || 0), [amount]);
  const resolvedOwedAmount = useMemo(
    () => Math.max(1, Number(owedAmount || amount || 0)),
    [owedAmount, amount]
  );
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? null,
    [accounts, accountId]
  );
  const selectedAccountAppearance = useMemo(
    () => (selectedAccount ? resolveAccountAppearance(selectedAccount) : null),
    [selectedAccount]
  );

  function resetForm() {
    setKind("GASTO");
    setClassification("PERSONAL");
    setAmount("");
    setDate(getToday());
    setDescription("");
    setCategoryId("");
    setNotes("");
    setBusinessUnitId("");
    setIsOwed(false);
    setOwedByType("PERSONA");
    setOwedBusinessUnitId("");
    setOwedDebtorMode("NEW");
    setOwedDebtorId("");
    setOwedDebtorName("");
    setOwedAmount("");
    setOwedNote("");
    setInstallmentsEnabled(false);
    setInstallmentCount("");
    setInstallmentValue("");
    setNextInstallmentDate("");
    setError(null);
  }

  function loadPrefs() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(QUICK_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as QuickPrefs;
      if (parsed.kind) setKind(parsed.kind);
      if (parsed.accountId) setAccountId(parsed.accountId);
      if (parsed.categoryId) setCategoryId(parsed.categoryId);
    } catch {
      // no-op
    }
  }

  function savePrefs(prefs: QuickPrefs) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(QUICK_PREFS_KEY, JSON.stringify(prefs));
  }

  useEffect(() => {
    if (!open) return;
    loadPrefs();
    async function loadCatalogs() {
      try {
        setLoading(true);
        const [accountsResponse, categoriesResponse, debtsResponse, dashboardResponse] = await Promise.all([
          fetch("/api/accounts", { cache: "no-store" }),
          fetch("/api/categories", { cache: "no-store" }),
          fetch("/api/debts", { cache: "no-store" }),
          fetch("/api/dashboard", { cache: "no-store" })
        ]);

        if (accountsResponse.ok) {
          const accountsPayload = (await accountsResponse.json()) as AccountsPayload;
          setAccounts(accountsPayload.items ?? []);
          if (!accountId && accountsPayload.items?.[0]?.id) {
            setAccountId(accountsPayload.items[0].id);
          }
        }
        if (categoriesResponse.ok) {
          const categoriesPayload = (await categoriesResponse.json()) as CategoriesPayload;
          setCategories(categoriesPayload.items ?? []);
        }
        if (debtsResponse.ok) {
          const debtsPayload = (await debtsResponse.json()) as DebtsPayload;
          setDebtors(debtsPayload.people ?? []);
        }
        if (dashboardResponse.ok) {
          const dashboardPayload = (await dashboardResponse.json()) as DashboardSnapshot;
          setDashboardSnapshot(dashboardPayload);
        }
      } catch {
        setError("No se pudieron cargar los datos del modal.");
      } finally {
        setLoading(false);
      }
    }

    void loadCatalogs();
  }, [open, accountId]);

  async function upsertPersonDebt() {
    if (owedDebtorMode === "EXISTING" && owedDebtorId) {
      const selectedDebtor = debtors.find((item) => item.id === owedDebtorId);
      if (!selectedDebtor) throw new Error("No se encontró la persona seleccionada.");

      const patchResponse = await fetch(`/api/debts/${owedDebtorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount: Math.max(1, selectedDebtor.totalAmount + resolvedOwedAmount),
          notes: owedNote || selectedDebtor.notes || null
        })
      });
      const patchPayload = (await patchResponse.json()) as { message?: string };
      if (!patchResponse.ok) throw new Error(patchPayload.message ?? "No se pudo actualizar la deuda.");
      return;
    }

    if (owedDebtorName.trim().length < 3) {
      throw new Error("Ingresa el nombre de la persona para registrar la deuda.");
    }

    const createResponse = await fetch("/api/debts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: owedDebtorName.trim(),
        reason: description || "Movimiento manual",
        totalAmount: resolvedOwedAmount,
        startDate: date,
        estimatedPayDate: null,
        isInstallmentDebt: installmentsEnabled,
        installmentCount: installmentsEnabled ? Math.max(0, Number(installmentCount || 0)) : 0,
        installmentValue: installmentsEnabled ? Math.max(0, Number(installmentValue || 0)) : 0,
        paidInstallments: 0,
        installmentFrequency: "MENSUAL",
        nextInstallmentDate: installmentsEnabled ? (nextInstallmentDate || null) : null,
        notes: owedNote || null
      })
    });
    const createPayload = (await createResponse.json()) as { message?: string };
    if (!createResponse.ok) throw new Error(createPayload.message ?? "No se pudo crear la deuda.");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!accountId) {
      setError("Selecciona una cuenta.");
      return;
    }
    if (!description.trim()) {
      setError("Agrega una descripción.");
      return;
    }
    if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
      setError("El monto debe ser mayor a 0.");
      return;
    }

    const isCreditCardPurchase = kind === "GASTO" && selectedAccount?.type === "CREDITO";
    if (isCreditCardPurchase && classification === "NEGOCIO" && !businessUnitId) {
      setError("Selecciona la unidad de negocio para esta compra.");
      return;
    }
    if (isCreditCardPurchase && classification === "PRESTADO") {
      if (!isOwed || owedByType !== "PERSONA") {
        setError("Para una compra prestada debes seleccionar una persona que te debe.");
        return;
      }
      if (installmentsEnabled && owedDebtorMode === "EXISTING") {
        setError("Para registrar cuotas, crea una deuda nueva (no usar persona existente por ahora).");
        return;
      }
      if (installmentsEnabled) {
        const count = Number(installmentCount || 0);
        const value = Number(installmentValue || 0);
        if (!Number.isFinite(count) || count < 1) {
          setError("Ingresa el total de cuotas (mínimo 1).");
          return;
        }
        if (!Number.isFinite(value) || value < 1) {
          setError("Ingresa un valor de cuota válido.");
          return;
        }
        if (!nextInstallmentDate) {
          setError("Selecciona la fecha de la próxima cuota.");
          return;
        }
      }
    }

    if (isOwed && owedByType === "EMPRESA" && !owedBusinessUnitId) {
      setError("Selecciona la empresa que te debe.");
      return;
    }

    setSaving(true);
    try {
      const isCompanyDebt = isOwed && owedByType === "EMPRESA";
      const isBusinessSpend = classification === "NEGOCIO";
      const isLentSpend = classification === "PRESTADO";
      const transactionType = kind === "INGRESO" ? "INGRESO" : "EGRESO";
      const baseNote = kind === "TRANSFERENCIA" ? "Transferencia manual" : "";
      const classificationNote =
        kind === "GASTO"
          ? classification === "NEGOCIO"
            ? "Clasificación: negocio"
            : classification === "PRESTADO"
              ? "Clasificación: prestado"
              : "Clasificación: personal"
          : "";
      const mergedNotes = [
        baseNote,
        classificationNote,
        notes.trim(),
        isOwed ? `Monto adeudado: ${resolvedOwedAmount}` : "",
        owedNote.trim()
      ]
        .filter(Boolean)
        .join(" · ");

      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          description: description.trim(),
          amount: Math.abs(resolvedAmount),
          type: transactionType,
          accountId,
          categoryId: categoryId || null,
          financialOrigin: isCompanyDebt || isBusinessSpend ? "EMPRESA" : "PERSONAL",
          businessUnitId: isCompanyDebt ? owedBusinessUnitId : isBusinessSpend ? (businessUnitId || null) : null,
          isBusinessPaidPersonally: (isCompanyDebt || isBusinessSpend) && transactionType === "EGRESO",
          isReimbursable: (isCompanyDebt || isLentSpend) && transactionType === "EGRESO",
          notes: mergedNotes || undefined
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "No se pudo registrar la transacción.");

      if (isOwed && owedByType === "PERSONA") {
        await upsertPersonDebt();
      }

      savePrefs({
        kind,
        accountId,
        categoryId
      });

      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar la transacción.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const isCreditCardPurchase = kind === "GASTO" && selectedAccount?.type === "CREDITO";

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/42 p-0 sm:items-center sm:p-4">
      <div className="glass-surface safe-pb w-full max-h-[92vh] overflow-y-auto rounded-t-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,250,252,0.9)_100%)] p-4 animate-fade-up ring-1 ring-white/35 sm:max-w-2xl sm:rounded-[32px] sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-violet-500">Nueva transacción</p>
            <h3 className="text-lg font-semibold text-slate-900">Registrar movimiento</h3>
            <div className="flex flex-wrap gap-2">
              <StatPill tone="premium">
                {kind === "GASTO" ? "Gasto" : kind === "INGRESO" ? "Ingreso" : "Transferencia"}
              </StatPill>
              {selectedAccountAppearance ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[11px]"
                    style={{
                      color: selectedAccountAppearance.accentColor,
                      backgroundColor: selectedAccountAppearance.accentBackground
                    }}
                  >
                    {selectedAccountAppearance.glyph}
                  </span>
                  {selectedAccount?.name ?? "Cuenta seleccionada"}
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
            className="tap-feedback rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <SurfaceCard variant="highlight" padding="sm" className="space-y-3">
            <label className="block space-y-2">
              <span className={fieldLabelClass}>Monto</span>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0"
                className="h-16 border-white/70 bg-white/95 text-center text-3xl font-semibold tracking-tight"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>

            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
              {(["GASTO", "INGRESO", "TRANSFERENCIA"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  className={`tap-feedback h-10 rounded-xl text-xs font-semibold transition ${
                    kind === value
                      ? "bg-white text-slate-900 shadow-[0_8px_16px_rgba(15,23,42,0.12)]"
                      : "text-slate-500"
                  }`}
                >
                  {value === "GASTO" ? "Gasto" : value === "INGRESO" ? "Ingreso" : "Transferencia"}
                </button>
              ))}
            </div>
          </SurfaceCard>

          {isCreditCardPurchase ? (
            <SurfaceCard variant="soft" padding="sm" className="space-y-3 interactive-lift">
              <div className="space-y-1">
                <p className={fieldLabelClass}>Clasificación</p>
                <p className="text-sm text-slate-500">Define si esta compra es personal, de negocio o prestada.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
                {(["PERSONAL", "NEGOCIO", "PRESTADO"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setClassification(value);
                      if (value === "PRESTADO") {
                        setIsOwed(true);
                        setOwedByType("PERSONA");
                        if (!owedAmount) setOwedAmount(amount);
                      } else {
                        setIsOwed(false);
                      }
                    }}
                    className={`tap-feedback h-10 rounded-xl text-xs font-semibold transition ${
                      classification === value
                        ? "bg-white text-slate-900 shadow-[0_8px_16px_rgba(15,23,42,0.12)]"
                        : "text-slate-500"
                    }`}
                  >
                    {value === "PERSONAL" ? "Personal" : value === "NEGOCIO" ? "Negocio" : "Prestado"}
                  </button>
                ))}
              </div>

              {classification === "NEGOCIO" ? (
                <label className="space-y-2">
                  <span className={fieldLabelClass}>Unidad de negocio</span>
                  <Select value={businessUnitId} onChange={(event) => setBusinessUnitId(event.target.value)}>
                    <option value="">Selecciona negocio</option>
                    {dashboardSnapshot?.references.businessUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : null}
            </SurfaceCard>
          ) : null}

          <SurfaceCard variant="soft" padding="sm" className="space-y-4 interactive-lift">
            <div className="space-y-1">
              <p className={fieldLabelClass}>Datos del movimiento</p>
              <p className="text-sm text-slate-500">
                Completa solo lo esencial para registrar tu dinero en pocos toques.
              </p>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="space-y-2">
                <span className={fieldLabelClass}>Categoría</span>
                <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="">Selecciona categoría</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="space-y-2">
                <span className={fieldLabelClass}>Cuenta</span>
                <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                  <option value="">Selecciona cuenta</option>
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
                      <p className="text-[11px] font-medium text-slate-500">
                        Apariencia {selectedAccountAppearance.appearanceMode === "auto" ? "automática" : "manual"}
                      </p>
                    </div>
                  </div>
                ) : null}
              </label>

              <label className="space-y-2">
                <span className={fieldLabelClass}>Fecha</span>
                <Input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>

              <label className="space-y-2">
                <span className={fieldLabelClass}>Descripción</span>
                <Input
                  placeholder="Ej: Supermercado, sueldo, Uber"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
            </div>
          </SurfaceCard>

          <SurfaceCard
            variant={isOwed ? "highlight" : "soft"}
            padding="sm"
            className="space-y-4 transition-all duration-200"
          >
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">¿Alguien me debe este gasto?</p>
                <p className="text-xs text-slate-500">
                  Si aplica, se crea o actualiza la cuenta por cobrar sin salir del flujo.
                </p>
              </div>
              <input type="checkbox" checked={isOwed} onChange={(event) => setIsOwed(event.target.checked)} />
            </label>

            {isOwed ? (
              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className={fieldLabelClass}>Quién debe</span>
                  <Select value={owedByType} onChange={(event) => setOwedByType(event.target.value as "PERSONA" | "EMPRESA")}>
                    <option value="PERSONA">Persona</option>
                    <option value="EMPRESA">Empresa</option>
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className={fieldLabelClass}>Monto adeudado</span>
                  <Input
                    type="number"
                    placeholder="Monto adeudado"
                    value={owedAmount}
                    onChange={(event) => setOwedAmount(event.target.value)}
                  />
                </label>

                {owedByType === "EMPRESA" ? (
                  <label className="space-y-2 sm:col-span-2">
                    <span className={fieldLabelClass}>Empresa que debe</span>
                    <Select
                      value={owedBusinessUnitId}
                      onChange={(event) => setOwedBusinessUnitId(event.target.value)}
                    >
                      <option value="">Selecciona empresa</option>
                      {dashboardSnapshot?.references.businessUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                ) : (
                  <>
                    <label className="space-y-2">
                      <span className={fieldLabelClass}>Modo</span>
                      <Select
                        value={owedDebtorMode}
                        onChange={(event) => setOwedDebtorMode(event.target.value as "EXISTING" | "NEW")}
                      >
                        <option value="NEW">Crear persona</option>
                        <option value="EXISTING">Usar persona existente</option>
                      </Select>
                    </label>
                    {owedDebtorMode === "EXISTING" ? (
                      <label className="space-y-2">
                        <span className={fieldLabelClass}>Persona</span>
                        <Select value={owedDebtorId} onChange={(event) => setOwedDebtorId(event.target.value)}>
                          <option value="">Selecciona persona</option>
                          {debtors.map((debtor) => (
                            <option key={debtor.id} value={debtor.id}>
                              {debtor.name}
                            </option>
                          ))}
                        </Select>
                      </label>
                    ) : (
                      <label className="space-y-2">
                        <span className={fieldLabelClass}>Nombre</span>
                        <Input
                          placeholder="Nombre de quien te debe"
                          value={owedDebtorName}
                          onChange={(event) => setOwedDebtorName(event.target.value)}
                        />
                      </label>
                    )}
                  </>
                )}

                {isOwed && owedByType === "PERSONA" ? (
                  <div className="sm:col-span-2 space-y-2">
                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">¿En cuotas?</p>
                        <p className="text-xs text-slate-500">Opcional: registra el cobro como deuda en cuotas.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={installmentsEnabled}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setInstallmentsEnabled(checked);
                          if (checked && !installmentCount) setInstallmentCount("3");
                          if (checked && !installmentValue && Number(amount)) {
                            const count = Number(installmentCount || 3);
                            setInstallmentValue(String(Math.ceil(Number(amount) / Math.max(1, count))));
                          }
                          if (checked && !nextInstallmentDate) {
                            const base = new Date(`${date}T12:00:00`);
                            base.setMonth(base.getMonth() + 1);
                            const y = base.getFullYear();
                            const m = `${base.getMonth() + 1}`.padStart(2, "0");
                            const d = `${base.getDate()}`.padStart(2, "0");
                            setNextInstallmentDate(`${y}-${m}-${d}`);
                          }
                        }}
                      />
                    </label>

                    {installmentsEnabled ? (
                      <div className="grid gap-2.5 sm:grid-cols-3">
                        <label className="space-y-2">
                          <span className={fieldLabelClass}>Total cuotas</span>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            placeholder="Ej: 6"
                            value={installmentCount}
                            onChange={(event) => setInstallmentCount(event.target.value)}
                          />
                        </label>
                        <label className="space-y-2">
                          <span className={fieldLabelClass}>Valor cuota</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            placeholder="Ej: 40000"
                            value={installmentValue}
                            onChange={(event) => setInstallmentValue(event.target.value)}
                          />
                        </label>
                        <label className="space-y-2">
                          <span className={fieldLabelClass}>Próxima cuota</span>
                          <Input
                            type="date"
                            value={nextInstallmentDate}
                            onChange={(event) => setNextInstallmentDate(event.target.value)}
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <label className="space-y-2 sm:col-span-2">
                  <span className={fieldLabelClass}>Nota de deuda</span>
                  <Input
                    placeholder="Ej: Compra con mi tarjeta, pago compartido, etc."
                    value={owedNote}
                    onChange={(event) => setOwedNote(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
          </SurfaceCard>

          <label className="block space-y-2">
            <span className={fieldLabelClass}>Notas internas</span>
            <textarea
              className={textareaClass}
              placeholder="Agrega contexto si quieres recordar algo del movimiento."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          {error ? (
            <SurfaceCard variant="soft" padding="sm" className="border-rose-200/80 bg-rose-50/80 text-rose-700">
              <p className="text-sm font-medium">{error}</p>
            </SurfaceCard>
          ) : null}
          {loading ? (
            <SurfaceCard variant="soft" padding="sm" className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-64" />
                <Skeleton className="h-3 w-52" />
              </div>
            </SurfaceCard>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="tap-feedback h-11 rounded-2xl"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="tap-feedback h-11 rounded-2xl sm:min-w-[220px]"
              disabled={saving || loading}
            >
              {saving ? "Guardando..." : "Guardar transacción"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
