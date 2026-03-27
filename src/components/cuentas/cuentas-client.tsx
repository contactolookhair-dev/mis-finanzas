"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { getCreditCardBillingPeriod } from "@/lib/accounts/credit-card-period";
import {
  buildCreditAttentionBadges,
  buildCreditAttentionContextLine,
  creditToneToClasses,
  getCreditAttentionSeverity
} from "@/lib/accounts/credit-attention";
import {
  generateCreditCardStatementInsights,
  type CreditCardStatementInsight
} from "@/lib/accounts/credit-card-statement-insights";
import {
  generateCreditCardStatementActions,
  type CreditCardStatementAction
} from "@/lib/accounts/credit-card-statement-actions";
import { NewTransactionModal } from "@/components/movimientos/new-transaction-modal";
import { BASE_TRANSACTION_MARKER } from "@/lib/constants/transactions";

const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500";

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

type CreditHealthItem = {
  accountId: string;
  name: string;
  bank: string | null;
  periodLabel: string;
  utilizationPct: number | null;
  importBatchId: string;
  totals: {
    interest: number;
    fees: number;
    cashAdvances: number;
    dubiousCount: number;
  };
  deltas: {
    billed: number | null;
    used: number | null;
    interest: number | null;
    fees: number | null;
  };
  badges: Array<{ key: string; label: string; tone: "alert" | "attention" | "positive" | "info" }>;
  priority: number;
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
  type StatementItem = {
    importBatchId: string;
    importedAt: string;
    detectedBank: string;
    statementKind: string;
    summary: {
      periodLabel: string;
      closingDate: string | null;
      dueDate: string | null;
      totalBilled: number | null;
      minimumPayment: number | null;
      creditLimit: number | null;
      usedLimit: number | null;
      availableLimit: number | null;
    };
    totals: {
      purchases: number;
      payments: number;
      interest: number;
      fees: number;
      cashAdvances: number;
      insurance: number;
      movementCount: number;
      dubiousCount: number;
    };
    warnings: string[];
    confidence: number | null;
  };

  const [statementHistory, setStatementHistory] = useState<StatementItem[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState<string>("");
  const [statementHistoryLoading, setStatementHistoryLoading] = useState(false);
  const [statementHistoryError, setStatementHistoryError] = useState<string | null>(null);
  const [showAllStatementPeriods, setShowAllStatementPeriods] = useState(false);
  const [showAllStatementWarnings, setShowAllStatementWarnings] = useState(false);
  const [showAllStatementActions, setShowAllStatementActions] = useState(false);

  const [statementItems, setStatementItems] = useState<
    {
      id: string;
      date: string;
      description: string;
      amount: number;
      type: "INGRESO" | "EGRESO" | "TRANSFERENCIA";
      accountId: string | null;
      origin?: "PERSONAL" | "EMPRESA";
    }[]
  >([]);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState<string | null>(null);

  const billingPeriod = useMemo(() => {
    if (!account || account.type !== "CREDITO") return null;
    return getCreditCardBillingPeriod({
      closingDay: account.closingDay,
      paymentDay: account.paymentDay
    });
  }, [account]);

  const statementCharges = useMemo(
    () => statementItems.filter((item) => item.amount < 0),
    [statementItems]
  );
  const statementPayments = useMemo(
    () => statementItems.filter((item) => item.amount > 0),
    [statementItems]
  );
  const statementChargesTotal = useMemo(
    () => statementCharges.reduce((sum, item) => sum + Math.abs(item.amount), 0),
    [statementCharges]
  );
  const statementPaymentsTotal = useMemo(
    () => statementPayments.reduce((sum, item) => sum + item.amount, 0),
    [statementPayments]
  );

  const router = useRouter();

  useEffect(() => {
    let active = true;
    async function loadStatementHistory() {
      if (!open || !account || account.type !== "CREDITO") {
        setStatementHistory([]);
        setSelectedStatementId("");
        setShowAllStatementPeriods(false);
        setShowAllStatementWarnings(false);
        return;
      }
      setStatementHistoryLoading(true);
      setStatementHistoryError(null);
      try {
        const response = await fetch(`/api/accounts/${account.id}/statements`, { cache: "no-store" });
        if (!response.ok) throw new Error("No se pudo cargar el historial de estados.");
        const payload = (await response.json()) as { items: StatementItem[] };
        if (!active) return;
        const items = payload.items ?? [];
        setStatementHistory(items);
        if (!selectedStatementId && items.length > 0) {
          setSelectedStatementId(items[0]!.importBatchId);
        }
      } catch (error) {
        if (!active) return;
        setStatementHistoryError(
          error instanceof Error ? error.message : "No se pudo cargar el historial de estados."
        );
      } finally {
        if (active) setStatementHistoryLoading(false);
      }
    }

    void loadStatementHistory();
    return () => {
      active = false;
    };
  }, [open, account, selectedStatementId]);

  useEffect(() => {
    setShowAllStatementWarnings(false);
    setShowAllStatementActions(false);
  }, [selectedStatementId]);

  const selectedStatement = useMemo(() => {
    if (!selectedStatementId) return statementHistory[0] ?? null;
    return statementHistory.find((item) => item.importBatchId === selectedStatementId) ?? null;
  }, [statementHistory, selectedStatementId]);

  const previousStatement = useMemo(() => {
    if (!selectedStatement) return null;
    const idx = statementHistory.findIndex((item) => item.importBatchId === selectedStatement.importBatchId);
    if (idx < 0) return null;
    return statementHistory[idx + 1] ?? null;
  }, [statementHistory, selectedStatement]);

  const statementInsights = useMemo<CreditCardStatementInsight[]>(() => {
    if (!selectedStatement) return [];
    return generateCreditCardStatementInsights({
      current: selectedStatement,
      previous: previousStatement ?? null,
      max: 6
    });
  }, [selectedStatement, previousStatement]);

  const selectedImportBatchId = useMemo(() => {
    return selectedStatement?.importBatchId ?? statementHistory[0]?.importBatchId ?? null;
  }, [selectedStatement, statementHistory]);

  const statementActions = useMemo<CreditCardStatementAction[]>(() => {
    if (!selectedStatement) return [];
    return generateCreditCardStatementActions({
      current: selectedStatement,
      previous: previousStatement ?? null,
      insights: statementInsights,
      importBatchId: selectedImportBatchId,
      max: 8
    });
  }, [selectedStatement, previousStatement, statementInsights, selectedImportBatchId]);

  function formatDelta(current: number | null, prev: number | null) {
    if (current === null || prev === null) return null;
    const delta = current - prev;
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) return { delta: 0, pct: 0 };
    const pct = prev === 0 ? null : delta / prev;
    return { delta, pct };
  }

  const creditImportHref =
    account && account.type === "CREDITO"
      ? `/importaciones?type=credit&accountId=${encodeURIComponent(account.id)}`
      : "/importaciones";

  useEffect(() => {
    let active = true;
    async function loadStatement() {
      if (!open || !account || account.type !== "CREDITO") {
        setStatementItems([]);
        return;
      }
      const period = getCreditCardBillingPeriod({
        closingDay: account.closingDay,
        paymentDay: account.paymentDay
      });
      setStatementLoading(true);
      setStatementError(null);
      try {
        const params = new URLSearchParams();
        params.set("take", "200");
        params.set("startDate", period.periodStart);
        params.set("endDate", period.periodEnd);
        params.set("accountId", account.id);
        const response = await fetch(`/api/transactions?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("No se pudo cargar el estado de cuenta.");
        const payload = (await response.json()) as {
          items: {
            id: string;
            date: string;
            description: string;
            amount: number;
            type: "INGRESO" | "EGRESO" | "TRANSFERENCIA";
            accountId: string | null;
            origin?: "PERSONAL" | "EMPRESA";
          }[];
        };
        if (!active) return;
        const filtered = (payload.items ?? []).filter((item) => item.description !== BASE_TRANSACTION_MARKER);
        setStatementItems(filtered);
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
  const credit =
    account.type === "CREDITO"
      ? computeCreditCardMetrics({ ...account, balance: account.creditBalance })
      : null;
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
  const visibleStatementPeriods = showAllStatementPeriods ? statementHistory : statementHistory.slice(0, 12);
  const visibleStatementActions = showAllStatementActions ? statementActions : statementActions.slice(0, 3);

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
          <>
            <SurfaceCard variant="soft" padding="sm" className="mt-4 space-y-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Estado de cuenta inteligente</p>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="mt-1 text-sm font-semibold text-slate-900">Historial de estados</h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Selecciona un período importado para ver su resumen y compararlo con el anterior.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {statementHistory.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSelectedStatementId(statementHistory[0]!.importBatchId)}
                        className="tap-feedback rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-slate-700"
                      >
                        Ver último
                      </button>
                    ) : null}
                    {selectedImportBatchId ? (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/importaciones?batchId=${encodeURIComponent(selectedImportBatchId)}`)
                        }
                        className="tap-feedback rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-slate-700"
                      >
                        Ver en Importaciones
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {statementHistoryLoading ? (
                <p className="text-xs text-slate-500">Cargando historial...</p>
              ) : statementHistoryError ? (
                <div className="rounded-2xl border border-rose-200/80 bg-rose-50/85 p-3">
                  <p className="text-xs font-semibold text-rose-700">No se pudo cargar el estado de cuenta.</p>
                  <p className="mt-1 text-[11px] text-rose-600">{statementHistoryError}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="h-9 rounded-2xl"
                      onClick={() => {
                        window.location.href = creditImportHref;
                      }}
                    >
                      Ir a Importaciones
                    </Button>
                  </div>
                </div>
              ) : statementHistory.length === 0 ? (
                <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                  <p className="text-xs font-semibold text-slate-700">
                    Aún no has importado un estado de cuenta para esta tarjeta.
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Sube tu PDF para completar automáticamente período, cupos y totales.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="h-9 rounded-2xl"
                      onClick={() => {
                        window.location.href = creditImportHref;
                      }}
                    >
                      Importar estado de cuenta
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 rounded-2xl"
                      onClick={() => router.push("/importaciones")}
                    >
                      Ir a Importaciones
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={showAllStatementPeriods ? "flex flex-wrap gap-2" : "flex gap-2 overflow-x-auto pb-1"}>
                    {visibleStatementPeriods.map((item) => {
                      const active = item.importBatchId === (selectedStatement?.importBatchId ?? statementHistory[0]!.importBatchId);
                      return (
                        <button
                          key={item.importBatchId}
                          type="button"
                          onClick={() => setSelectedStatementId(item.importBatchId)}
                          className={`tap-feedback shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                            active
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white/85 text-slate-700"
                          }`}
                        >
                          {item.summary.periodLabel}
                        </button>
                      );
                    })}
                    {statementHistory.length > 12 ? (
                      <button
                        type="button"
                        onClick={() => setShowAllStatementPeriods((value) => !value)}
                        className="tap-feedback shrink-0 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-slate-700"
                      >
                        {showAllStatementPeriods ? "Mostrar menos" : "Mostrar más"}
                      </button>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Período facturado</p>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                        {selectedStatement?.summary.periodLabel ?? "—"}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {selectedStatement?.confidence !== null && selectedStatement?.confidence !== undefined
                          ? `Confianza ${Math.round(selectedStatement.confidence * 100)}%`
                          : "Confianza —"}
                        {" · "}
                        {selectedStatement && selectedStatement.totals.dubiousCount > 0
                          ? `${selectedStatement.totals.dubiousCount} dudosas`
                          : "Sin dudosas"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Movimientos</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {selectedStatement?.totals.movementCount ?? 0}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Total facturado</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {selectedStatement?.summary.totalBilled === null || selectedStatement?.summary.totalBilled === undefined
                          ? "—"
                          : formatCurrency(selectedStatement.summary.totalBilled)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Pago mínimo:{" "}
                        {selectedStatement?.summary.minimumPayment === null || selectedStatement?.summary.minimumPayment === undefined
                          ? "—"
                          : formatCurrency(selectedStatement.summary.minimumPayment)}
                      </p>
                      {previousStatement ? (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {(() => {
                            const d = formatDelta(selectedStatement?.summary.totalBilled ?? null, previousStatement.summary.totalBilled);
                            if (!d) return "vs anterior —";
                            const sign = d.delta > 0 ? "+" : d.delta < 0 ? "−" : "";
                            const pct = d.pct === null ? "" : ` (${sign}${Math.round(Math.abs(d.pct) * 100)}%)`;
                            return `vs anterior ${sign}${formatCurrency(Math.abs(d.delta))}${pct}`;
                          })()}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Cupo</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        Disponible:{" "}
                        {selectedStatement?.summary.availableLimit === null || selectedStatement?.summary.availableLimit === undefined
                          ? "—"
                          : formatCurrency(selectedStatement.summary.availableLimit)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Usado:{" "}
                        {selectedStatement?.summary.usedLimit === null || selectedStatement?.summary.usedLimit === undefined
                          ? "—"
                          : formatCurrency(selectedStatement.summary.usedLimit)}
                        {" · "}
                        Total:{" "}
                        {selectedStatement?.summary.creditLimit === null || selectedStatement?.summary.creditLimit === undefined
                          ? "—"
                          : formatCurrency(selectedStatement.summary.creditLimit)}
                      </p>
                      {previousStatement ? (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {(() => {
                            const d = formatDelta(selectedStatement?.summary.usedLimit ?? null, previousStatement.summary.usedLimit);
                            if (!d) return "vs anterior —";
                            const sign = d.delta > 0 ? "+" : d.delta < 0 ? "−" : "";
                            const pct = d.pct === null ? "" : ` (${sign}${Math.round(Math.abs(d.pct) * 100)}%)`;
                            return `Cupo usado vs anterior ${sign}${formatCurrency(Math.abs(d.delta))}${pct}`;
                          })()}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Cierre</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {selectedStatement?.summary.closingDate ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pago</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {selectedStatement?.summary.dueDate ?? "—"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Totales compras</p>
                      <p className="mt-1 text-base font-semibold text-rose-700">
                        {formatCurrency(selectedStatement?.totals.purchases ?? 0)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Movimientos: {selectedStatement?.totals.movementCount ?? 0}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Totales abonos</p>
                      <p className="mt-1 text-base font-semibold text-emerald-700">
                        {formatCurrency(selectedStatement?.totals.payments ?? 0)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Dudosas: {selectedStatement?.totals.dubiousCount ?? 0}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Intereses / comisiones</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        Intereses: {formatCurrency(selectedStatement?.totals.interest ?? 0)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Comisiones: {formatCurrency(selectedStatement?.totals.fees ?? 0)}
                      </p>
                      {previousStatement ? (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {(() => {
                            const dI = formatDelta(selectedStatement?.totals.interest ?? null, previousStatement.totals.interest);
                            const dF = formatDelta(selectedStatement?.totals.fees ?? null, previousStatement.totals.fees);
                            const sI = dI ? (dI.delta > 0 ? "+" : dI.delta < 0 ? "−" : "") : "";
                            const sF = dF ? (dF.delta > 0 ? "+" : dF.delta < 0 ? "−" : "") : "";
                            return `vs anterior int ${dI ? `${sI}${formatCurrency(Math.abs(dI.delta))}` : "—"} · com ${dF ? `${sF}${formatCurrency(Math.abs(dF.delta))}` : "—"}`;
                          })()}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Avances / seguros</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        Avances: {formatCurrency(selectedStatement?.totals.cashAdvances ?? 0)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Seguros: {formatCurrency(selectedStatement?.totals.insurance ?? 0)}
                      </p>
                    </div>
                  </div>

                  {statementInsights.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Insights automáticos
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Lectura rápida basada en este estado y su comparación.
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {statementInsights.map((insight) => {
                          const tone =
                            insight.tone === "alert"
                              ? "border-rose-200 bg-rose-50 text-rose-800"
                              : insight.tone === "attention"
                                ? "border-amber-200 bg-amber-50 text-amber-900"
                                : insight.tone === "positive"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                  : "border-slate-200 bg-slate-50 text-slate-800";
                          const badge =
                            insight.tone === "alert"
                              ? "Alerta"
                              : insight.tone === "attention"
                                ? "Atención"
                                : insight.tone === "positive"
                                  ? "Positivo"
                                  : "Info";
                          return (
                            <div key={`${insight.tone}-${insight.title}`} className={`rounded-2xl border px-3 py-2 ${tone}`}>
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold">{insight.title}</p>
                                <span className="shrink-0 rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-semibold">
                                  {badge}
                                </span>
                              </div>
                              {insight.detail ? (
                                <p className="mt-1 text-xs leading-relaxed opacity-90">{insight.detail}</p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {statementActions.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Acciones sugeridas
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Próximos pasos simples para mejorar tu tarjeta.
                          </p>
                        </div>
                        {statementActions.length > 3 ? (
                          <button
                            type="button"
                            onClick={() => setShowAllStatementActions((value) => !value)}
                            className="tap-feedback rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-slate-700"
                          >
                            {showAllStatementActions ? "Mostrar menos" : "Mostrar más"}
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-2 space-y-2">
                        {visibleStatementActions.map((action) => {
                          const dot =
                            action.tone === "alert"
                              ? "bg-rose-500"
                              : action.tone === "attention"
                                ? "bg-amber-500"
                                : action.tone === "positive"
                                  ? "bg-emerald-500"
                                  : "bg-slate-400";
                          const toneText =
                            action.tone === "alert"
                              ? "text-rose-800"
                              : action.tone === "attention"
                                ? "text-amber-900"
                                : action.tone === "positive"
                                  ? "text-emerald-900"
                                  : "text-slate-800";
                          return (
                            <div
                              key={`${action.tone}-${action.title}`}
                              className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/80 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
                                  <p className={`truncate text-sm font-semibold ${toneText}`}>{action.title}</p>
                                </div>
                                {action.detail ? (
                                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{action.detail}</p>
                                ) : null}
                              </div>
                              {action.href ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Next.js typedRoutes doesn't infer template-literal query strings well here.
                                    router.push(action.href as any);
                                  }}
                                  className="tap-feedback shrink-0 rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-slate-700"
                                >
                                  Abrir
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {selectedStatement && selectedStatement.warnings.length > 0 ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">
                          Warnings <span className="font-normal">({selectedStatement.warnings.length})</span>
                        </p>
                        {selectedStatement.warnings.length > 3 ? (
                          <button
                            type="button"
                            onClick={() => setShowAllStatementWarnings((value) => !value)}
                            className="tap-feedback rounded-full border border-amber-200 bg-white/60 px-2.5 py-1 text-[11px] font-semibold text-amber-800"
                          >
                            {showAllStatementWarnings ? "Mostrar menos" : "Mostrar más"}
                          </button>
                        ) : null}
                      </div>
                      <ul className="mt-1 list-disc pl-4">
                        {(showAllStatementWarnings ? selectedStatement.warnings : selectedStatement.warnings.slice(0, 3)).map((w, idx) => (
                          <li key={`${idx}-${w}`} className="mt-1">
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </SurfaceCard>

            <SurfaceCard variant="soft" padding="sm" className="mt-4 space-y-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Estado de cuenta</p>
                <h4 className="mt-1 text-sm font-semibold text-slate-900">Período actual</h4>
                <p className="mt-1 text-xs text-slate-500">
                  {billingPeriod
                    ? `${billingPeriod.periodStart} → ${billingPeriod.periodEnd}`
                    : "Basado en movimientos registrados en esta tarjeta."}
                </p>
              </div>

            {statementLoading ? (
              <p className="text-xs text-slate-500">Cargando estado de cuenta...</p>
            ) : statementError ? (
              <div className="rounded-2xl border border-rose-200/80 bg-rose-50/85 p-3">
                <p className="text-xs font-semibold text-rose-700">No se pudo cargar el estado de cuenta.</p>
                <p className="mt-1 text-[11px] text-rose-600">{statementError}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 rounded-2xl"
                    onClick={() => {
                      window.location.href = creditImportHref;
                    }}
                  >
                    Revisar importación
                  </Button>
                </div>
              </div>
            ) : statementItems.length === 0 ? (
              <p className="text-xs text-slate-500">Aún no hay movimientos registrados en este período.</p>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Compras del período</p>
                    <p className="mt-1 text-lg font-semibold text-rose-700">{formatCurrency(statementChargesTotal)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pagos del período</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-700">{formatCurrency(statementPaymentsTotal)}</p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Próximo cierre</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {billingPeriod ? formatDate(billingPeriod.nextCloseDate.toISOString()) : "—"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Fecha de pago</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {billingPeriod?.dueDate ? formatDate(billingPeriod.dueDate.toISOString()) : "—"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Compras del período</p>
                    <div className="mt-2 space-y-2">
                      {statementCharges.length === 0 ? (
                        <p className="text-xs text-slate-500">Sin compras aún.</p>
                      ) : (
                        statementCharges.slice(0, 8).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/85 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">{item.description}</p>
                              <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(item.date)}</p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold text-rose-700">
                              {formatCurrency(Math.abs(item.amount))}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pagos realizados</p>
                    <div className="mt-2 space-y-2">
                      {statementPayments.length === 0 ? (
                        <p className="text-xs text-slate-500">Sin pagos registrados en este período.</p>
                      ) : (
                        statementPayments.slice(0, 6).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/85 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">{item.description}</p>
                              <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(item.date)}</p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold text-emerald-700">
                              {formatCurrency(item.amount)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
            </SurfaceCard>
          </>
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
  const [creditHealth, setCreditHealth] = useState<CreditHealthItem[]>([]);
  const [creditHealthLoading, setCreditHealthLoading] = useState(false);
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
  const [showAllCreditAttention, setShowAllCreditAttention] = useState(false);
  const searchParams = useSearchParams();

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

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const sortedCreditAttention = useMemo(() => {
    return [...creditHealth].sort((a, b) => {
      const sa = getCreditAttentionSeverity(a);
      const sb = getCreditAttentionSeverity(b);
      if (sa.rank !== sb.rank) return sa.rank - sb.rank;
      return b.priority - a.priority;
    });
  }, [creditHealth]);

  const visibleCreditAttention = useMemo(() => {
    return showAllCreditAttention ? sortedCreditAttention : sortedCreditAttention.slice(0, 5);
  }, [showAllCreditAttention, sortedCreditAttention]);

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

  const loadAccounts = useCallback(async () => {
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
  }, []);

  const loadCreditHealth = useCallback(async () => {
    try {
      setCreditHealthLoading(true);
      const response = await fetch("/api/accounts/credit/health", { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo cargar la salud de tarjetas.");
      const payload = (await response.json()) as { items: CreditHealthItem[] };
      setCreditHealth(payload.items ?? []);
    } catch {
      // Non-blocking; keep the Accounts screen functional.
      setCreditHealth([]);
    } finally {
      setCreditHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
    void loadCreditHealth();
  }, [loadAccounts, loadCreditHealth]);

  useEffect(() => {
    const card = searchParams.get("card");
    if (!card) return;
    // Only open once accounts are loaded enough to match the card.
    if (!accounts.length) return;
    const exists = accounts.some((a) => a.id === card);
    if (exists) {
      setDetailAccountId(card);
    }
  }, [accounts, searchParams]);

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

      {creditHealthLoading ? (
        <SurfaceCard variant="soft" padding="sm" className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tarjetas</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">Revisando salud de tarjetas...</p>
          </div>
          <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-slate-400" />
          </div>
        </SurfaceCard>
      ) : creditHealth.length > 0 ? (
        <SurfaceCard variant="soft" padding="sm" className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Tarjetas que requieren atencion
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                Revisa rapidamente las tarjetas con senales importantes.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Basado en tu ultimo estado importado por tarjeta.
              </p>
            </div>
            {creditHealth.length > 5 ? (
              <button
                type="button"
                onClick={() => setShowAllCreditAttention((v) => !v)}
                className="tap-feedback rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-slate-700"
              >
                {showAllCreditAttention ? "Mostrar menos" : "Mostrar mas"}
              </button>
            ) : null}
          </div>

          <div className="space-y-2">
            {visibleCreditAttention.map((item) => {
              const account = accountById.get(item.accountId);
              const visual = account ? resolveAccountVisual(account) : null;
              const Icon = visual?.icon ?? CreditCard;
              const accentColor = account ? normalizeHexColor(account.color) ?? DEFAULT_ACCOUNT_ACCENT[account.type] : "#0f172a";
              const accentBackground = hexToRgba(accentColor, 0.14);
              const contextLine = buildCreditAttentionContextLine(item);
              const contextBadges = buildCreditAttentionBadges(item).slice(0, 4);

              return (
                <div
                  key={item.accountId}
                  className="interactive-lift flex items-start justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/92 px-3 py-2"
                >
                  <button
                    type="button"
                    className="tap-feedback flex min-w-0 items-start gap-3 text-left"
                    onClick={() => setDetailAccountId(item.accountId)}
                  >
                    <div
                      className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border"
                      style={{ borderColor: accentColor, backgroundColor: accentBackground }}
                    >
                      {account?.icon ? (
                        <span className="text-xl leading-none">{account.icon}</span>
                      ) : (
                        <Icon className="h-5 w-5 text-slate-900" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {item.name}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[12px] font-medium text-slate-600">
                        {contextLine}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {item.bank ?? visual?.label ?? "Tarjeta"} · {item.periodLabel}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {contextBadges.map((b) => {
                          const tone = creditToneToClasses(b.tone);
                          return (
                            <span
                              key={b.key}
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone}`}
                            >
                              {b.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailAccountId(item.accountId)}
                    className="tap-feedback shrink-0 rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-slate-700"
                  >
                    Ver
                  </button>
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      ) : null}

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
                const credit =
                  account.type === "CREDITO"
                    ? computeCreditCardMetrics({ ...account, balance: account.creditBalance })
                    : null;
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
