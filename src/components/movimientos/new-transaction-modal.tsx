"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { DashboardSnapshot } from "@/shared/types/dashboard";

type AccountItem = {
  id: string;
  name: string;
  bank: string;
  type: "CREDITO" | "DEBITO" | "EFECTIVO";
  balance: number;
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

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function NewTransactionModal({ open, onOpenChange, onSuccess }: Props) {
  const [kind, setKind] = useState<TransactionKind>("GASTO");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getToday());
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [isOwed, setIsOwed] = useState(false);
  const [owedByType, setOwedByType] = useState<"PERSONA" | "EMPRESA">("PERSONA");
  const [owedBusinessUnitId, setOwedBusinessUnitId] = useState("");
  const [owedDebtorMode, setOwedDebtorMode] = useState<"EXISTING" | "NEW">("NEW");
  const [owedDebtorId, setOwedDebtorId] = useState("");
  const [owedDebtorName, setOwedDebtorName] = useState("");
  const [owedAmount, setOwedAmount] = useState("");
  const [owedNote, setOwedNote] = useState("");

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

  function resetForm() {
    setKind("GASTO");
    setAmount("");
    setDate(getToday());
    setDescription("");
    setCategoryId("");
    setNotes("");
    setIsOwed(false);
    setOwedByType("PERSONA");
    setOwedBusinessUnitId("");
    setOwedDebtorMode("NEW");
    setOwedDebtorId("");
    setOwedDebtorName("");
    setOwedAmount("");
    setOwedNote("");
    setError(null);
  }

  useEffect(() => {
    if (!open) return;
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
    if (isOwed && owedByType === "EMPRESA" && !owedBusinessUnitId) {
      setError("Selecciona la empresa que te debe.");
      return;
    }

    setSaving(true);
    try {
      const isCompanyDebt = isOwed && owedByType === "EMPRESA";
      const transactionType = kind === "INGRESO" ? "INGRESO" : "EGRESO";
      const baseNote = kind === "TRANSFERENCIA" ? "Transferencia manual" : "";
      const mergedNotes = [baseNote, notes.trim(), isOwed ? `Monto adeudado: ${resolvedOwedAmount}` : "", owedNote.trim()]
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
          financialOrigin: isCompanyDebt ? "EMPRESA" : "PERSONAL",
          businessUnitId: isCompanyDebt ? owedBusinessUnitId : null,
          isBusinessPaidPersonally: isCompanyDebt && transactionType === "EGRESO",
          isReimbursable: isCompanyDebt && transactionType === "EGRESO",
          notes: mergedNotes || undefined
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "No se pudo registrar la transacción.");

      if (isOwed && owedByType === "PERSONA") {
        await upsertPersonDebt();
      }

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

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/35 p-0 sm:items-center sm:p-4">
      <div className="w-full rounded-t-[28px] bg-white p-4 shadow-[0_-16px_40px_rgba(15,23,42,0.18)] sm:max-w-2xl sm:rounded-[30px] sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-violet-500">Nueva transacción</p>
            <h3 className="text-lg font-semibold text-slate-900">Registrar movimiento</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
            className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-xs font-medium text-slate-500">Monto</span>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              className="h-14 text-center text-3xl font-semibold tracking-tight"
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
                className={`h-9 rounded-xl text-xs font-semibold transition ${
                  kind === value
                    ? "bg-white text-slate-900 shadow-[0_8px_16px_rgba(15,23,42,0.12)]"
                    : "text-slate-500"
                }`}
              >
                {value === "GASTO" ? "Gasto" : value === "INGRESO" ? "Ingreso" : "Transferencia"}
              </button>
            ))}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>

            <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">Cuenta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.bank}
                </option>
              ))}
            </Select>

            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />

            <Input
              placeholder="Descripción"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <input type="checkbox" checked={isOwed} onChange={(event) => setIsOwed(event.target.checked)} />
            <span className="text-sm text-slate-600">¿Alguien me debe este gasto?</span>
          </label>

          {isOwed ? (
            <div className="grid gap-2.5 rounded-2xl bg-slate-50 p-3 sm:grid-cols-2">
              <Select value={owedByType} onChange={(event) => setOwedByType(event.target.value as "PERSONA" | "EMPRESA")}>
                <option value="PERSONA">Persona</option>
                <option value="EMPRESA">Empresa</option>
              </Select>

              <Input
                type="number"
                placeholder="Monto adeudado"
                value={owedAmount}
                onChange={(event) => setOwedAmount(event.target.value)}
              />

              {owedByType === "EMPRESA" ? (
                <Select
                  className="sm:col-span-2"
                  value={owedBusinessUnitId}
                  onChange={(event) => setOwedBusinessUnitId(event.target.value)}
                >
                  <option value="">Empresa que debe</option>
                  {dashboardSnapshot?.references.businessUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <>
                  <Select
                    value={owedDebtorMode}
                    onChange={(event) => setOwedDebtorMode(event.target.value as "EXISTING" | "NEW")}
                  >
                    <option value="NEW">Crear persona</option>
                    <option value="EXISTING">Usar persona existente</option>
                  </Select>
                  {owedDebtorMode === "EXISTING" ? (
                    <Select value={owedDebtorId} onChange={(event) => setOwedDebtorId(event.target.value)}>
                      <option value="">Selecciona persona</option>
                      {debtors.map((debtor) => (
                        <option key={debtor.id} value={debtor.id}>
                          {debtor.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      placeholder="Nombre deudor"
                      value={owedDebtorName}
                      onChange={(event) => setOwedDebtorName(event.target.value)}
                    />
                  )}
                </>
              )}

              <Input
                className="sm:col-span-2"
                placeholder="Nota deuda (opcional)"
                value={owedNote}
                onChange={(event) => setOwedNote(event.target.value)}
              />
            </div>
          ) : null}

          <Input
            placeholder="Nota (opcional)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {loading ? <p className="text-xs text-slate-500">Cargando opciones...</p> : null}

          <Button type="submit" className="h-11 w-full" disabled={saving || loading}>
            {saving ? "Guardando..." : "Guardar transacción"}
          </Button>
        </form>
      </div>
    </div>
  );
}
