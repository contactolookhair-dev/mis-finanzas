"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SurfaceCard } from "@/components/ui/surface-card";
import { resolveAccountAppearance } from "@/lib/accounts/account-appearance";
import { formatCurrency } from "@/lib/formatters/currency";
import type { TransactionRow } from "@/hooks/use-transactions-with-filters";

type AccountItem = {
  id: string;
  name: string;
  bank: string;
  type: "CREDITO" | "DEBITO" | "EFECTIVO";
  balance: number;
  creditBalance: number;
  color: string | null;
  icon: string | null;
  appearanceMode: "auto" | "manual";
};

type CreditImpactType = "consume_cupo" | "no_consume_cupo" | "pago_tarjeta" | "ajuste_manual";

const CREDIT_IMPACT_OPTIONS: { value: CreditImpactType; label: string }[] = [
  { value: "consume_cupo", label: "Compra nueva · consume cupo" },
  { value: "no_consume_cupo", label: "Ya considerada · solo historial" },
  { value: "pago_tarjeta", label: "Pago de tarjeta · libera cupo" },
  { value: "ajuste_manual", label: "Ajuste manual · corrige deuda" }
];

type CategoryItem = {
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  transaction: TransactionRow | null;
  accounts: AccountItem[];
  categories: CategoryItem[];
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

function ymdFromIso(iso: string) {
  return iso.slice(0, 10);
}

const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500";

export function EditTransactionModal({
  open,
  transaction,
  accounts,
  categories,
  onOpenChange,
  onSuccess
}: Props) {
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"INGRESO" | "EGRESO">("EGRESO");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [creditImpactType, setCreditImpactType] = useState<CreditImpactType>("consume_cupo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedAmount = useMemo(() => Number(amount || 0), [amount]);

  useEffect(() => {
    if (!open || !transaction) return;
    setError(null);
    setDate(ymdFromIso(transaction.date));
    setDescription(transaction.description ?? "");
    setAmount(String(Math.abs(transaction.amount ?? 0)));
    setType(transaction.amount >= 0 ? "INGRESO" : "EGRESO");

    const matchedAccountId =
      transaction.accountId ??
      accounts.find((a) => a.name.trim().toLowerCase() === transaction.account.trim().toLowerCase())?.id ??
      "";
    setAccountId(matchedAccountId);

    const matchedCategoryId =
      transaction.categoryId ??
      categories.find((c) => c.name.trim().toLowerCase() === transaction.category.trim().toLowerCase())?.id ??
      "";
    setCategoryId(matchedCategoryId);
    
    setNotes(transaction.notes ?? "");
    setCreditImpactType((transaction.creditImpactType ?? "consume_cupo") as CreditImpactType);
  }, [open, transaction, accounts, categories]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId]
  );
  const selectedAppearance = useMemo(
    () => (selectedAccount ? resolveAccountAppearance(selectedAccount) : null),
    [selectedAccount]
  );

  if (!open || !transaction) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
      <SurfaceCard
        variant="soft"
        padding="lg"
        className="safe-pb w-full max-h-[92vh] overflow-y-auto rounded-t-[28px] bg-white/95 shadow-[0_30px_70px_rgba(15,23,42,0.25)] ring-1 ring-slate-100 sm:max-w-lg sm:rounded-[28px]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Editar movimiento</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatCurrency(transaction.amount)}
            </p>
          </div>
          <button
            type="button"
            className="tap-feedback rounded-full border border-slate-200 bg-white/85 p-2 text-slate-700"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);

            if (!date) {
              setError("Selecciona una fecha.");
              return;
            }
            if (description.trim().length < 3) {
              setError("La descripción debe tener al menos 3 caracteres.");
              return;
            }
            if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
              setError("El monto debe ser mayor a 0.");
              return;
            }
            if (!accountId) {
              setError("Selecciona una cuenta.");
              return;
            }

            try {
              setSaving(true);
              const response = await fetch(`/api/transactions/${transaction.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  date,
                  description: description.trim(),
                  amount: resolvedAmount,
                  type,
                  accountId,
                  categoryId: categoryId || null,
                  notes: notes.trim() ? notes.trim() : null,
                  creditImpactType
                })
              });
              const payload = (await response.json().catch(() => ({}))) as { message?: string };
              if (!response.ok) throw new Error(payload.message ?? "No se pudo editar el movimiento.");

              try {
                window.dispatchEvent(new Event("mis-finanzas:accounts-changed"));
              } catch {
                // noop
              }

              onOpenChange(false);
              onSuccess?.();
            } catch (err) {
              setError(err instanceof Error ? err.message : "No se pudo editar el movimiento.");
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className={fieldLabelClass}>Fecha</p>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Tipo</p>
              <Select value={type} onChange={(e) => setType(e.target.value as "INGRESO" | "EGRESO")}>
                <option value="EGRESO">Gasto</option>
                <option value="INGRESO">Ingreso</option>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <p className={fieldLabelClass}>Descripción</p>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className={fieldLabelClass}>Monto</p>
              <Input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <p className={fieldLabelClass}>Categoría</p>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <p className={fieldLabelClass}>Cuenta</p>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Selecciona una cuenta</option>
              {accounts.map((a) => {
                const ap = resolveAccountAppearance(a);
                return (
                  <option key={a.id} value={a.id}>
                    {`${ap.glyph} ${a.name} · ${a.bank}`}
                  </option>
                );
              })}
            </Select>
            {selectedAppearance ? (
              <div
                className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700"
                style={{ borderColor: selectedAppearance.accentColor }}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-sm"
                  style={{
                    color: selectedAppearance.accentColor,
                    backgroundColor: selectedAppearance.accentBackground
                  }}
                >
                  {selectedAppearance.glyph}
                </span>
                <div className="min-w-0">
                  <p className="truncate">{selectedAppearance.bankLabel}</p>
                  <p className="text-[11px] font-medium text-slate-500">Cuenta seleccionada</p>
                </div>
              </div>
            ) : null}
          </div>

          {selectedAccount?.type === "CREDITO" ? (
            <label className="space-y-2">
              <span className={fieldLabelClass}>Impacto en el cupo</span>
              <Select value={creditImpactType} onChange={(event) => setCreditImpactType(event.target.value as CreditImpactType)}>
                {CREDIT_IMPACT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}

          <div className="space-y-1">
            <p className={fieldLabelClass}>Notas (opcional)</p>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: compra para..." />
          </div>

          {error ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-full px-4"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="h-10 rounded-full px-4" disabled={saving}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </SurfaceCard>
    </div>
  );
}
