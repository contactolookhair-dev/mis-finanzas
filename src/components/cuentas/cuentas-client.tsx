"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  CreditCard,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  Wallet,
  WalletCards,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyStateCard, ErrorStateCard, SkeletonCard } from "@/components/ui/states";
import { SectionHeader } from "@/components/ui/section-header";
import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatCurrency } from "@/lib/formatters/currency";

const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500";

type AccountItem = {
  id: string;
  name: string;
  bank: string;
  type: "CREDITO" | "DEBITO" | "EFECTIVO";
  balance: number;
  color: string | null;
  icon: string | null;
};

type AccountsPayload = {
  items: AccountItem[];
};

const typeLabel: Record<AccountItem["type"], string> = {
  CREDITO: "Crédito",
  DEBITO: "Débito",
  EFECTIVO: "Efectivo"
};

type AccountVisualKind = "TARJETA" | "BANCO" | "EFECTIVO" | "AHORRO";

function resolveAccountVisual(account: AccountItem): {
  kind: AccountVisualKind;
  icon: ComponentType<{ className?: string }>;
  label: string;
  chipClassName: string;
  iconWrapClassName: string;
} {
  const looksLikeSavings = /ahorro|savings|saving/i.test(`${account.name} ${account.bank ?? ""}`);

  const kind: AccountVisualKind =
    account.type === "EFECTIVO"
      ? "EFECTIVO"
      : account.type === "CREDITO"
        ? "TARJETA"
        : looksLikeSavings
          ? "AHORRO"
          : "BANCO";

  const icon =
    kind === "EFECTIVO"
      ? Wallet
      : kind === "TARJETA"
        ? CreditCard
        : kind === "AHORRO"
          ? PiggyBank
          : Landmark;

  const label =
    kind === "EFECTIVO" ? "Efectivo" : kind === "TARJETA" ? "Tarjeta" : kind === "AHORRO" ? "Ahorro" : "Banco";

  const chipClassName =
    kind === "EFECTIVO"
      ? "bg-amber-50 text-amber-700 ring-amber-100"
      : kind === "TARJETA"
        ? "bg-slate-50 text-slate-700 ring-slate-200"
        : kind === "AHORRO"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : "bg-blue-50 text-blue-700 ring-blue-100";

  const iconWrapClassName =
    kind === "EFECTIVO"
      ? "bg-amber-50 text-amber-700 ring-amber-100"
      : kind === "TARJETA"
        ? "bg-slate-50 text-slate-700 ring-slate-200"
        : kind === "AHORRO"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : "bg-blue-50 text-blue-700 ring-blue-100";

  return { kind, icon, label, chipClassName, iconWrapClassName };
}

function AccountUpsertModal({
  open,
  mode,
  form,
  saving,
  error,
  onClose,
  onSubmit,
  onChange,
  showSuccess,
  successMessage
}: {
  open: boolean;
  mode: "create" | "edit";
  form: {
    name: string;
    bank: string;
    type: AccountItem["type"];
    openingBalance: string;
    color: string;
    icon: string;
  };
  saving: boolean;
  error: string | null;
  showSuccess: boolean;
  successMessage: string | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: (patch: Partial<typeof form>) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/42 p-0 sm:items-center sm:p-4">
      <div className="glass-surface safe-pb w-full max-h-[92vh] overflow-y-auto rounded-t-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(248,250,252,0.92)_100%)] p-4 animate-fade-up ring-1 ring-white/35 sm:max-w-xl sm:rounded-[32px] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {mode === "edit" ? "Editar cuenta" : "Nueva cuenta"}
            </p>
            <h3 className="text-lg font-semibold text-slate-900">
              {mode === "edit" ? "Actualizar datos" : "Crear cuenta"}
            </h3>
            <p className="text-sm text-slate-500">
              Solo lo esencial: nombre, tipo y banco. Opcionales al final si quieres personalizar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tap-feedback rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <SurfaceCard variant="soft" padding="sm" className="space-y-4 interactive-lift">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className={fieldLabelClass}>Nombre visible</span>
                <Input
                  placeholder="Ej: Falabella, Billetera, Cuenta corriente"
                  value={form.name}
                  onChange={(event) => onChange({ name: event.target.value })}
                />
              </label>

              <label className="space-y-2">
                <span className={fieldLabelClass}>Tipo</span>
                <Select
                  value={form.type}
                  onChange={(event) => onChange({ type: event.target.value as AccountItem["type"] })}
                >
                  <option value="DEBITO">Banco / Débito</option>
                  <option value="CREDITO">Tarjeta / Crédito</option>
                  <option value="EFECTIVO">Efectivo</option>
                </Select>
              </label>

              <label className="space-y-2">
                <span className={fieldLabelClass}>Banco (opcional)</span>
                <Input
                  placeholder="Ej: Banco Falabella, Scotiabank"
                  value={form.bank}
                  onChange={(event) => onChange({ bank: event.target.value })}
                />
              </label>

              {mode === "create" ? (
                <label className="space-y-2 sm:col-span-2">
                  <span className={fieldLabelClass}>Saldo inicial (opcional)</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={form.openingBalance}
                    onChange={(event) => onChange({ openingBalance: event.target.value })}
                  />
                </label>
              ) : null}
            </div>
          </SurfaceCard>

          <details className="group">
            <summary className="tap-feedback cursor-pointer select-none rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              Opciones de apariencia (opcional)
            </summary>
            <SurfaceCard variant="soft" padding="sm" className="mt-3 space-y-4">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className={fieldLabelClass}>Color</span>
                  <Input
                    placeholder="Ej: #2563EB"
                    value={form.color}
                    onChange={(event) => onChange({ color: event.target.value })}
                  />
                </label>
                <label className="space-y-2">
                  <span className={fieldLabelClass}>Ícono</span>
                  <Input
                    placeholder="Ej: 💳"
                    value={form.icon}
                    onChange={(event) => onChange({ icon: event.target.value })}
                  />
                </label>
              </div>
            </SurfaceCard>
          </details>

          {error ? (
            <SurfaceCard variant="soft" padding="sm" className="border-rose-200/80 bg-rose-50/80 text-rose-700">
              <p className="text-sm font-medium">{error}</p>
            </SurfaceCard>
          ) : null}
          {showSuccess && successMessage ? (
            <SurfaceCard
              variant="soft"
              padding="sm"
              className="border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
            >
              <p className="text-sm font-medium">{successMessage}</p>
            </SurfaceCard>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="submit"
              disabled={saving || form.name.trim().length < 2}
              className="h-11 rounded-2xl"
            >
              {saving ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear cuenta"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-11 rounded-2xl"
              onClick={onClose}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AccountDetailModal({
  open,
  account,
  onClose,
  onEdit,
  onDelete
}: {
  open: boolean;
  account: AccountItem | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!open || !account) return null;
  const visual = resolveAccountVisual(account);
  const Icon = visual.icon;
  const balanceTone = account.balance >= 0 ? "text-emerald-700" : "text-rose-700";

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/42 p-0 sm:items-center sm:p-4">
      <div className="glass-surface safe-pb w-full max-h-[92vh] overflow-y-auto rounded-t-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(248,250,252,0.92)_100%)] p-4 animate-fade-up ring-1 ring-white/35 sm:max-w-lg sm:rounded-[32px] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${visual.iconWrapClassName}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-slate-900">{account.name}</p>
              <p className="text-xs text-slate-500">
                {(account.bank?.trim() ? account.bank : visual.label) ?? visual.label} · {typeLabel[account.type]}
              </p>
              <span className={`inline-flex w-fit rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${visual.chipClassName}`}>
                {visual.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tap-feedback rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <SurfaceCard variant="soft" padding="sm" className="space-y-3">
          <p className={fieldLabelClass}>Saldo</p>
          <p className={`text-3xl font-semibold tracking-tight ${balanceTone}`}>{formatCurrency(account.balance)}</p>
          <p className="text-sm text-slate-500">Tipo: {typeLabel[account.type]}</p>
        </SurfaceCard>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="secondary" className="h-11 rounded-2xl" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-11 rounded-2xl border-rose-200/80 bg-rose-50/88 text-rose-700 hover:bg-rose-50"
            onClick={onDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CuentasClient() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    bank: "",
    type: "DEBITO" as AccountItem["type"],
    openingBalance: "",
    color: "",
    icon: ""
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUpsertOpen, setIsUpsertOpen] = useState(false);
  const [detailAccountId, setDetailAccountId] = useState<string | null>(null);

  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      const byBalance = b.balance - a.balance;
      if (byBalance !== 0) return byBalance;
      return a.name.localeCompare(b.name);
    });
  }, [accounts]);

  const selectedAccount = useMemo(
    () => (detailAccountId ? accounts.find((account) => account.id === detailAccountId) ?? null : null),
    [accounts, detailAccountId]
  );

  const resetForm = () => {
    setForm({
      name: "",
      bank: "",
      type: "DEBITO",
      openingBalance: "",
      color: "",
      icon: ""
    });
  };

  function openCreate() {
    setEditingId(null);
    resetForm();
    setSuccess(null);
    setError(null);
    setIsUpsertOpen(true);
  }

  function openEdit(account: AccountItem) {
    setEditingId(account.id);
    setForm({
      name: account.name,
      bank: account.bank ?? "",
      type: account.type,
      openingBalance: "",
      color: account.color ?? "",
      icon: account.icon ?? ""
    });
    setSuccess(null);
    setError(null);
    setIsUpsertOpen(true);
  }

  function closeUpsert() {
    setIsUpsertOpen(false);
    setEditingId(null);
    resetForm();
  }

  async function loadAccounts() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/accounts", { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudieron cargar las cuentas.");
      const payload = (await response.json()) as AccountsPayload;
      setAccounts(payload.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error cargando cuentas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const openingBalance =
        editingId || form.openingBalance === "" ? undefined : Number(form.openingBalance);
      const response = await fetch(
        editingId ? `/api/accounts/${editingId}` : "/api/accounts",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            bank: form.bank || null,
            type: form.type,
            openingBalance,
            color: form.color || undefined,
            icon: form.icon || undefined
          })
      });
      const body = (await response.json()) as AccountsPayload & { message?: string };
      if (!response.ok) throw new Error(body.message ?? "No se pudo crear la cuenta.");
      setAccounts(body.items);
      setSuccess(editingId ? "Cuenta actualizada correctamente." : "Cuenta creada correctamente.");
      setIsUpsertOpen(false);
      setEditingId(null);
      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear la cuenta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <SectionHeader
        eyebrow="Cuentas"
        title="Tus cuentas"
        description="Crea, edita y elimina tus cuentas. Mantén todo simple y operativo."
        actions={
          <div className="hidden items-center gap-2 sm:flex">
            <StatPill tone="neutral">{accounts.length} cuentas</StatPill>
            <Button
              type="button"
              className="h-10 rounded-full px-4"
              onClick={openCreate}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva cuenta
            </Button>
          </div>
        }
      />

      {success ? (
        <SurfaceCard
          variant="soft"
          padding="sm"
          className="border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
        >
          <p className="text-sm font-medium">{success}</p>
        </SurfaceCard>
      ) : null}

      <div className="space-y-2">
        {loading ? <SkeletonCard lines={3} /> : null}
        {!loading && error ? (
          <ErrorStateCard
            title="No se pudieron cargar tus carteras"
            details={error}
            onRetry={loadAccounts}
          />
        ) : null}
        {!loading && !error && accounts.length === 0 ? (
          <EmptyStateCard
            icon={WalletCards}
            title="Comienza agregando tu primera cuenta"
            description="Registra tu billetera, banco o tarjeta para empezar a anotar movimientos."
            actionLabel="Agregar cuenta"
            onAction={openCreate}
          />
        ) : null}
        {sortedAccounts.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedAccounts.map((account) => {
              const visual = resolveAccountVisual(account);
              const Icon = visual.icon;
              const balanceTone = account.balance >= 0 ? "text-emerald-700" : "text-rose-700";
              const bankOrType = account.bank?.trim() ? account.bank : visual.label;

              return (
                <SurfaceCard
                  key={account.id}
                  variant="soft"
                  padding="sm"
                  className="interactive-lift group cursor-pointer animate-fade-up"
                  onClick={() => setDetailAccountId(account.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setDetailAccountId(account.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {bankOrType}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
                        {account.name}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ${visual.iconWrapClassName}`}>
                        {account.icon ? <span className="text-base leading-none">{account.icon}</span> : <Icon className="h-5 w-5" />}
                      </div>

                      <div className="flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-10 w-10 rounded-2xl"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(account);
                          }}
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-10 w-10 rounded-2xl border-rose-200/70 bg-rose-50/88 text-rose-700 hover:bg-rose-50"
                          onClick={(event) => {
                            event.stopPropagation();
                            void (async () => {
                              if (!window.confirm("¿Eliminar esta cuenta?")) return;
                              setSaving(true);
                              setError(null);
                              try {
                                const response = await fetch(`/api/accounts/${account.id}`, {
                                  method: "DELETE"
                                });
                                const body = (await response.json()) as AccountsPayload & { message?: string };
                                if (!response.ok) throw new Error(body.message ?? "No se pudo eliminar.");
                                setAccounts(body.items);
                                setSuccess("Cuenta eliminada.");
                                if (detailAccountId === account.id) setDetailAccountId(null);
                              } catch (deleteError) {
                                setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar.");
                              } finally {
                                setSaving(false);
                              }
                            })();
                          }}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-slate-500">Saldo</p>
                    <p className={`text-2xl font-semibold tracking-tight ${balanceTone}`}>
                      {formatCurrency(account.balance)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {visual.label} · {typeLabel[account.type]}
                    </p>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>
        ) : null}
      </div>

      <div
        className="fixed right-4 z-40 sm:hidden"
        style={{
          bottom: "calc(100px + env(safe-area-inset-bottom))"
        }}
      >
        <Button
          type="button"
          onClick={openCreate}
          className="h-12 rounded-full px-4 shadow-[0_18px_40px_rgba(37,99,235,0.22)]"
        >
          <Plus className="h-5 w-5" />
          <span className="ml-2 hidden font-semibold min-[380px]:inline">Cuenta</span>
        </Button>
      </div>

      <AccountUpsertModal
        open={isUpsertOpen}
        mode={editingId ? "edit" : "create"}
        form={form}
        saving={saving}
        error={error}
        showSuccess={false}
        successMessage={null}
        onClose={closeUpsert}
        onSubmit={handleCreate}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
      />

      <AccountDetailModal
        open={Boolean(detailAccountId)}
        account={selectedAccount}
        onClose={() => setDetailAccountId(null)}
        onEdit={() => {
          if (!selectedAccount) return;
          setDetailAccountId(null);
          openEdit(selectedAccount);
        }}
        onDelete={() => {
          if (!selectedAccount) return;
          void (async () => {
            if (!window.confirm("¿Eliminar esta cuenta?")) return;
            setSaving(true);
            setError(null);
            try {
              const response = await fetch(`/api/accounts/${selectedAccount.id}`, { method: "DELETE" });
              const body = (await response.json()) as AccountsPayload & { message?: string };
              if (!response.ok) throw new Error(body.message ?? "No se pudo eliminar.");
              setAccounts(body.items);
              setSuccess("Cuenta eliminada.");
              setDetailAccountId(null);
            } catch (deleteError) {
              setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar.");
            } finally {
              setSaving(false);
            }
          })();
        }}
      />
    </div>
  );
}
