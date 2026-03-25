"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Check,
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
import { formatDate } from "@/lib/formatters/date";
import { computeCreditCardMetrics } from "@/lib/accounts/credit-card";
import { NewTransactionModal } from "@/components/movimientos/new-transaction-modal";
import { BASE_TRANSACTION_MARKER } from "@/lib/constants/transactions";

const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500";

type AccountItem = {
  id: string;
  name: string;
  bank: string;
  type: "CREDITO" | "DEBITO" | "EFECTIVO";
  balance: number;
  color: string | null;
  icon: string | null;
  appearanceMode: "auto" | "manual";
  creditLimit: number | null;
  closingDay: number | null;
  paymentDay: number | null;
};

type AccountFormState = {
  name: string;
  bank: string;
  type: AccountItem["type"];
  openingBalance: string;
  currentBalance: string;
  creditLimit: string;
  closingDay: string;
  paymentDay: string;
  color: string;
  icon: string;
  appearanceMode: "auto" | "manual";
};

type AccountsPayload = {
  items: AccountItem[];
};

const typeLabel: Record<AccountItem["type"], string> = {
  CREDITO: "Crédito",
  DEBITO: "Débito",
  EFECTIVO: "Efectivo"
};

const INSTITUTION_PRESETS = [
  { label: "Banco de Chile", keywords: ["banco de chile", "bch"], color: "#0039a6", icon: "🏦" },
  { label: "BancoEstado", keywords: ["bancoestado", "banco estado"], color: "#024e9c", icon: "🏛️" },
  { label: "Santander", keywords: ["santander"], color: "#da1212", icon: "🎯" },
  { label: "BCI", keywords: ["bci"], color: "#0057a0", icon: "🌐" },
  { label: "Scotiabank", keywords: ["scotiabank"], color: "#b21f24", icon: "🛡️" },
  { label: "Itaú", keywords: ["itau"], color: "#ff7c23", icon: "⚡" },
  { label: "Falabella", keywords: ["falabella"], color: "#5c2e91", icon: "💳" },
  { label: "MACH", keywords: ["mach"], color: "#6c63ff", icon: "📱" },
  { label: "Tenpo", keywords: ["tenpo"], color: "#0d9488", icon: "🧭" },
  { label: "Mercado Pago", keywords: ["mercado", "mercadopago"], color: "#009ee6", icon: "🛒" }
];

const COLOR_PALETTE = [
  "#2563eb",
  "#0f766e",
  "#f97316",
  "#14b8a6",
  "#a855f7",
  "#ec4899",
  "#0ea5e9",
  "#22c55e",
  "#f59e0b"
];

const ICON_CATALOG = ["💳", "🏦", "💰", "🧾", "📱", "🌟"];

const DEFAULT_ACCOUNT_ACCENT: Record<AccountItem["type"], string> = {
  CREDITO: "#9333ea",
  DEBITO: "#2563eb",
  EFECTIVO: "#f59e0b"
};

function normalizeHexColor(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{3}$/.test(withoutHash) && !/^[0-9a-fA-F]{6}$/.test(withoutHash)) {
    return null;
  }
  const expanded = withoutHash.length === 3
    ? withoutHash.split("").map((char) => char + char).join("")
    : withoutHash;
  return `#${expanded.toLowerCase()}`;
}

function hexToRgba(hex: string, alpha = 0.12) {
  const normalized = normalizeHexColor(hex) ?? "#cbd5f5";
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function detectInstitutionPreset(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return (
    INSTITUTION_PRESETS.find((preset) =>
      preset.keywords.some((keyword) => normalized.includes(keyword))
    ) ?? null
  );
}


type AccountVisualKind = "TARJETA" | "BANCO" | "EFECTIVO" | "AHORRO";

function resolveAccountVisual(account: AccountItem): {
  kind: AccountVisualKind;
  icon: ComponentType<{ className?: string }>;
  label: string;
  chipClassName: string;
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

  return { kind, icon, label, chipClassName };
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
  form: AccountFormState;
  saving: boolean;
  error: string | null;
  showSuccess: boolean;
  successMessage: string | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: (patch: Partial<AccountFormState>) => void;
}) {
  const matchedInstitution = detectInstitutionPreset(form.bank);
  const isAutoMode = form.appearanceMode === "auto" && Boolean(matchedInstitution);
  const previewColor = form.color || matchedInstitution?.color || "#e2e8f0";
  const previewIcon = form.icon || matchedInstitution?.icon || "💳";
  const previewName = form.name.trim() || matchedInstitution?.label || "Cuenta";

  useEffect(() => {
    if (!open || form.appearanceMode !== "auto") return;
    const match = detectInstitutionPreset(form.bank);
    if (!match) return;
    if (form.color === match.color && form.icon === match.icon) return;
    onChange({ color: match.color, icon: match.icon });
  }, [open, form.bank, form.appearanceMode, form.color, form.icon, onChange]);

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

              {form.type === "CREDITO" ? (
                <div className="grid gap-2.5 sm:col-span-2 sm:grid-cols-3">
                  <label className="space-y-2 sm:col-span-2">
                    <span className={fieldLabelClass}>Cupo total (opcional)</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={form.creditLimit}
                      onChange={(event) => onChange({ creditLimit: event.target.value, appearanceMode: form.appearanceMode })}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className={fieldLabelClass}>Día de cierre</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      placeholder="Ej: 25"
                      value={form.closingDay}
                      onChange={(event) => onChange({ closingDay: event.target.value })}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className={fieldLabelClass}>Día de pago</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      placeholder="Ej: 5"
                      value={form.paymentDay}
                      onChange={(event) => onChange({ paymentDay: event.target.value })}
                    />
                  </label>
                </div>
              ) : null}

              {mode === "create" ? (
                <label className="space-y-2 sm:col-span-2">
                  <span className={fieldLabelClass}>
                    {form.type === "CREDITO" ? "Deuda inicial (opcional)" : "Saldo inicial (opcional)"}
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={form.openingBalance}
                    onChange={(event) => onChange({ openingBalance: event.target.value })}
                  />
                </label>
              ) : (
                <label className="space-y-2 sm:col-span-2">
                  <span className={fieldLabelClass}>
                    {form.type === "CREDITO" ? "Deuda actual" : "Saldo actual"}
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={form.currentBalance}
                    onChange={(event) => onChange({ currentBalance: event.target.value })}
                  />
                </label>
              )}
            </div>
          </SurfaceCard>

          <details className="group">
            <summary className="tap-feedback cursor-pointer select-none rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              Opciones de apariencia (opcional)
            </summary>
            <SurfaceCard variant="soft" padding="sm" className="mt-3">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Apariencia</p>
                    <p className="text-sm text-slate-500">
                      {isAutoMode && matchedInstitution
                        ? `Sugerido por ${matchedInstitution.label}.`
                        : "Personaliza color e icono manualmente."}
                    </p>
                  </div>
                  {matchedInstitution && form.appearanceMode !== "auto" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                      onClick={() => onChange({ appearanceMode: "auto" })}
                    >
                      Usar sugerencia automática
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
                  <div className="space-y-3">
                    <div
                      className="rounded-[26px] border border-slate-200/80 p-4 shadow-sm"
                      style={{
                        borderColor: previewColor,
                        backgroundImage: `linear-gradient(180deg, ${previewColor}20, ${previewColor}08)`
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Vista previa</p>
                          <p className="text-lg font-semibold text-slate-900 line-clamp-2">{previewName}</p>
                        </div>
                        <span className="text-3xl">{previewIcon}</span>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        {form.appearanceMode === "auto"
                          ? "Los colores se ajustan automáticamente al banco detectado."
                          : "La vista previa refleja tu personalización manual."}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className={fieldLabelClass}>Color</p>
                      <div className="mt-2 grid grid-cols-5 gap-2">
                        {COLOR_PALETTE.map((option) => {
                          const isActive = option.toLowerCase() === form.color.toLowerCase();
                          return (
                            <button
                              key={option}
                              type="button"
                              style={{ backgroundColor: option }}
                              className={`relative h-10 w-10 rounded-2xl border transition ${
                                isActive ? "border-slate-900 shadow-lg" : "border-slate-200"
                              }`}
                              onClick={() => onChange({ color: option, appearanceMode: "manual" })}
                              aria-label={`Color ${option}`}
                            >
                              {isActive ? (
                                <Check className="absolute right-1 top-1 h-4 w-4 text-white" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className={fieldLabelClass}>Icono</p>
                      <div className="mt-2 grid grid-cols-6 gap-2">
                        {ICON_CATALOG.map((option) => {
                          const isActive = option === form.icon;
                          return (
                            <button
                              key={option}
                              type="button"
                              className={`relative flex h-10 w-10 items-center justify-center rounded-2xl border bg-white text-2xl transition ${
                                isActive ? "border-slate-900 shadow-lg" : "border-slate-200"
                              }`}
                              onClick={() => onChange({ icon: option, appearanceMode: "manual" })}
                              aria-label={`Icono ${option}`}
                            >
                              {option}
                              {isActive ? (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white">
                                  <Check className="h-3 w-3" />
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
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
  onAddPurchase,
  onRegisterPayment,
  onEdit,
  onDelete
}: {
  open: boolean;
  account: AccountItem | null;
  onClose: () => void;
  onAddPurchase: () => void;
  onRegisterPayment: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [statementItems, setStatementItems] = useState<
    { id: string; date: string; description: string; amount: number; account: string }[]
  >([]);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadStatement() {
      if (!open || !account || account.type !== "CREDITO") {
        setStatementItems([]);
        return;
      }
      setStatementLoading(true);
      setStatementError(null);
      try {
        const now = new Date();
        const startDate = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-01`;
        const endDate = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;
        const params = new URLSearchParams();
        params.set("take", "80");
        params.set("startDate", startDate);
        params.set("endDate", endDate);
        const response = await fetch(`/api/transactions?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("No se pudo cargar el estado de cuenta.");
        const payload = (await response.json()) as { items: { id: string; date: string; description: string; amount: number; account: string }[] };
        if (!active) return;
        const filtered = (payload.items ?? [])
          .filter((item) => item.description !== BASE_TRANSACTION_MARKER)
          .filter((item) => item.account === account.name)
          .filter((item) => item.amount < 0);
        setStatementItems(filtered.slice(0, 12));
      } catch (error) {
        if (!active) return;
        setStatementError(error instanceof Error ? error.message : "No se pudo cargar el estado de cuenta.");
      } finally {
        if (active) setStatementLoading(false);
      }
    }

    void loadStatement();
    return () => {
      active = false;
    };
  }, [open, account]);

  if (!open || !account) return null;
  const visual = resolveAccountVisual(account);
  const Icon = visual.icon;
  const credit = account.type === "CREDITO" ? computeCreditCardMetrics(account) : null;
  const balanceTone =
    account.type === "CREDITO"
      ? credit && credit.debt > 0
        ? "text-rose-700"
        : "text-emerald-700"
      : account.balance >= 0
        ? "text-emerald-700"
        : "text-rose-700";
  const accentColor = normalizeHexColor(account.color) ?? DEFAULT_ACCOUNT_ACCENT[account.type];
  const accentBackground = hexToRgba(accentColor, 0.12);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/42 p-0 sm:items-center sm:p-4">
      <div className="glass-surface safe-pb w-full max-h-[92vh] overflow-y-auto rounded-t-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(248,250,252,0.92)_100%)] p-4 animate-fade-up ring-1 ring-white/35 sm:max-w-lg sm:rounded-[32px] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl font-semibold"
              style={{ borderColor: accentColor, backgroundColor: accentBackground }}
            >
              {account.icon ? (
                <span className="text-2xl leading-none">{account.icon}</span>
              ) : (
                <Icon className="h-5 w-5 text-slate-900" />
              )}
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
          {account.type === "CREDITO" && credit ? (
            <>
              <p className={fieldLabelClass}>Tarjeta de crédito</p>
              <p className={`text-3xl font-semibold tracking-tight ${balanceTone}`}>{formatCurrency(credit.debt)}</p>
              <div className="grid gap-2 rounded-2xl border border-slate-200/70 bg-white/85 p-3 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Cupo disponible</span>
                  <span className="font-semibold text-slate-900">
                    {credit.available === null ? "—" : formatCurrency(credit.available)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Cupo total</span>
                  <span className="font-semibold text-slate-900">
                    {credit.creditLimit === null ? "—" : formatCurrency(credit.creditLimit)}
                  </span>
                </div>
                {credit.creditLimit ? (
                  <div className="space-y-1.5">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-400 transition-[width] duration-500 ease-out"
                        style={{ width: `${Math.round((credit.utilization ?? 0) * 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Utilizado: {formatCurrency(credit.debt)}</span>
                      <span>{Math.round((credit.utilization ?? 0) * 100)}%</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">Define un cupo para ver el disponible.</p>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Cierre</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {account.closingDay ? `Día ${account.closingDay}` : "Sin configurar"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pago</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {account.paymentDay ? `Día ${account.paymentDay}` : "Sin configurar"}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="secondary" className="h-11 rounded-2xl" onClick={onAddPurchase}>
                  Agregar compra
                </Button>
                <Button type="button" className="h-11 rounded-2xl" onClick={onRegisterPayment}>
                  Registrar pago
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className={fieldLabelClass}>Saldo</p>
              <p className={`text-3xl font-semibold tracking-tight ${balanceTone}`}>{formatCurrency(account.balance)}</p>
              <p className="text-sm text-slate-500">Tipo: {typeLabel[account.type]}</p>
              <p className="text-xs text-slate-500">
                Apariencia: {account.appearanceMode === "auto" ? "Automática" : "Manual"}
              </p>
            </>
          )}
        </SurfaceCard>

        {account.type === "CREDITO" ? (
          <SurfaceCard variant="soft" padding="sm" className="mt-4 space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Estado de cuenta</p>
              <h4 className="mt-1 text-sm font-semibold text-slate-900">Compras del período</h4>
              <p className="mt-1 text-xs text-slate-500">Basado en movimientos registrados en esta tarjeta.</p>
            </div>

            {statementLoading ? (
              <p className="text-xs text-slate-500">Cargando compras...</p>
            ) : statementError ? (
              <p className="text-xs text-rose-600">{statementError}</p>
            ) : statementItems.length === 0 ? (
              <p className="text-xs text-slate-500">Aún no hay compras registradas en este período.</p>
            ) : (
              <div className="space-y-2">
                {statementItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/85 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.description}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(item.date)}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-rose-700">{formatCurrency(Math.abs(item.amount))}</p>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        ) : null}

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
  const [form, setForm] = useState<AccountFormState>({
    name: "",
    bank: "",
    type: "DEBITO" as AccountItem["type"],
    openingBalance: "",
    currentBalance: "",
    creditLimit: "",
    closingDay: "",
    paymentDay: "",
    color: "",
    icon: "",
    appearanceMode: "auto"
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUpsertOpen, setIsUpsertOpen] = useState(false);
  const [detailAccountId, setDetailAccountId] = useState<string | null>(null);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);

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
      currentBalance: "",
      creditLimit: "",
      closingDay: "",
      paymentDay: "",
      color: "",
      icon: "",
      appearanceMode: "auto"
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
    const creditDebt = account.type === "CREDITO" ? Math.max(0, -account.balance) : account.balance;
    setForm({
      name: account.name,
      bank: account.bank ?? "",
      type: account.type,
      openingBalance: "",
      currentBalance: creditDebt.toString(),
      creditLimit: account.creditLimit ? String(account.creditLimit) : "",
      closingDay: account.closingDay ? String(account.closingDay) : "",
      paymentDay: account.paymentDay ? String(account.paymentDay) : "",
      color: account.color ?? "",
      icon: account.icon ?? "",
      appearanceMode: account.appearanceMode ?? "manual"
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

  const openNewTransactionForAccount = (kind: "GASTO" | "INGRESO", accountId: string) => {
    try {
      window.localStorage.setItem(
        "mis-finanzas.quick-transaction",
        JSON.stringify({ kind, accountId })
      );
    } catch {
      // noop
    }
    setTransactionModalOpen(true);
  };

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
      const parsedOpening =
        editingId || form.openingBalance === "" ? undefined : Number(form.openingBalance);
      const parsedCurrent = editingId && form.currentBalance !== "" ? Number(form.currentBalance) : undefined;
      const openingBalance =
        typeof parsedOpening === "number" && Number.isFinite(parsedOpening)
          ? form.type === "CREDITO"
            ? -Math.abs(parsedOpening)
            : parsedOpening
          : undefined;
      const currentBalance =
        typeof parsedCurrent === "number" && Number.isFinite(parsedCurrent)
          ? form.type === "CREDITO"
            ? -Math.abs(parsedCurrent)
            : parsedCurrent
          : undefined;

      const creditLimit = form.creditLimit !== "" ? Number(form.creditLimit) : undefined;
      const closingDay = form.closingDay !== "" ? Number(form.closingDay) : undefined;
      const paymentDay = form.paymentDay !== "" ? Number(form.paymentDay) : undefined;
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
            currentBalance,
            creditLimit,
            closingDay,
            paymentDay,
            color: form.color || undefined,
            icon: form.icon || undefined,
            appearanceMode: form.appearanceMode
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
              const credit = account.type === "CREDITO" ? computeCreditCardMetrics(account) : null;
              const balanceTone =
                account.type === "CREDITO"
                  ? credit && credit.debt > 0
                    ? "text-rose-700"
                    : "text-emerald-700"
                  : account.balance >= 0
                    ? "text-emerald-700"
                    : "text-rose-700";
              const bankOrType = account.bank?.trim() ? account.bank : visual.label;
              const accentColor = normalizeHexColor(account.color) ?? DEFAULT_ACCOUNT_ACCENT[account.type];
              const accentBackground = hexToRgba(accentColor, 0.16);
              const accountGlyph = account.icon ? (
                <span className="text-2xl leading-none">{account.icon}</span>
              ) : (
                <Icon className="h-5 w-5 text-slate-900" />
              );

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

                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl font-semibold shadow-sm"
                        style={{ borderColor: accentColor, backgroundColor: accentBackground }}
                      >
                        {accountGlyph}
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
                    {account.type === "CREDITO" && credit ? (
                      <>
                        <p className="text-xs text-slate-500">Deuda actual</p>
                        <p className={`text-2xl font-semibold tracking-tight ${balanceTone}`}>
                          {formatCurrency(credit.debt)}
                        </p>
                        {credit.creditLimit ? (
                          <div className="space-y-2 rounded-2xl border border-slate-200/70 bg-slate-950/90 p-3 text-white">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-white/80">
                              <span>Cupo disponible</span>
                              <span className="text-white">{formatCurrency(credit.available ?? 0)}</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-400"
                                style={{ width: `${Math.round(((credit.utilization ?? 0) * 100))}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-white/70">
                              {formatCurrency(credit.creditLimit)} total · {Math.round((credit.utilization ?? 0) * 100)}% usado
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">
                            Tarjeta de crédito · define un cupo para ver disponible.
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-slate-500">Saldo</p>
                        <p className={`text-2xl font-semibold tracking-tight ${balanceTone}`}>
                          {formatCurrency(account.balance)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {visual.label} · {typeLabel[account.type]}
                        </p>
                      </>
                    )}
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
          bottom: "calc(112px + env(safe-area-inset-bottom))"
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
        onAddPurchase={() => {
          if (!selectedAccount) return;
          openNewTransactionForAccount("GASTO", selectedAccount.id);
        }}
        onRegisterPayment={() => {
          if (!selectedAccount) return;
          openNewTransactionForAccount("INGRESO", selectedAccount.id);
        }}
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

      <NewTransactionModal
        open={transactionModalOpen}
        onOpenChange={setTransactionModalOpen}
        onSuccess={() => void loadAccounts()}
      />
    </div>
  );
}
