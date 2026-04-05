"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Sparkles,
  Wallet2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { StatPill } from "@/components/ui/stat-pill";
import { Skeleton } from "@/components/ui/states";

type AccountItem = {
  id: string;
  name: string;
  bank: string | null;
  type: "CREDITO" | "DEBITO" | "EFECTIVO";
};

type CategoryItem = {
  id: string;
  name: string;
};

type WizardState = {
  accountId: string | null;
  amount: string;
  movementType: "GASTO" | "INGRESO" | "TRANSFERENCIA" | null;
  categoryId: string | null;
  note: string;
};

const STEPS = [
  { key: "welcome", title: "Bienvenida" },
  { key: "account", title: "¿Desde dónde pagaste este gasto?" },
  { key: "amount", title: "¿Cuánto pagaste?" },
  { key: "type", title: "¿Qué tipo de movimiento fue?" },
  { key: "category", title: "¿En qué categoría cae?" },
  { key: "note", title: "¿Quieres agregar un detalle?" },
  { key: "review", title: "Revisa antes de confirmar" }
] as const;

function normalizeAmountInput(value: string) {
  // Keep it simple for demo: allow digits and one leading minus (income/transfer may be positive anyway).
  const cleaned = value.replace(/[^\d-]/g, "");
  if (cleaned.startsWith("-")) {
    return `-${cleaned.slice(1).replace(/-/g, "")}`;
  }
  return cleaned.replace(/-/g, "");
}

function parseAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function AddExpenseWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  const [state, setState] = useState<WizardState>({
    accountId: null,
    amount: "",
    movementType: "GASTO",
    categoryId: null,
    note: ""
  });

  useEffect(() => {
    let alive = true;
    async function loadAccounts() {
      try {
        setAccountsLoading(true);
        const res = await fetch("/api/accounts", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const payload = (await res.json()) as { items?: AccountItem[] };
        const items = (payload.items ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          bank: a.bank ?? null,
          type: a.type
        }));
        if (alive) setAccounts(items);
      } catch {
        if (alive) {
          // Safe fallback for lab mode.
          setAccounts([
            { id: "demo-credit", name: "Credito demo", bank: "Falabella", type: "CREDITO" },
            { id: "demo-cash", name: "Efectivo", bank: null, type: "EFECTIVO" }
          ]);
        }
      } finally {
        if (alive) setAccountsLoading(false);
      }
    }
    void loadAccounts();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadCategories() {
      try {
        setCategoriesLoading(true);
        const res = await fetch("/api/categories", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const payload = (await res.json()) as { items?: CategoryItem[] };
        const items = (payload.items ?? []).map((c) => ({ id: c.id, name: c.name }));
        if (alive) setCategories(items);
      } catch {
        if (alive) {
          setCategories([
            { id: "demo-food", name: "Comida" },
            { id: "demo-transport", name: "Transporte" },
            { id: "demo-home", name: "Hogar" },
            { id: "demo-services", name: "Servicios" },
            { id: "demo-other", name: "Otros" }
          ]);
        }
      } finally {
        if (alive) setCategoriesLoading(false);
      }
    }
    void loadCategories();
    return () => {
      alive = false;
    };
  }, []);

  const step = STEPS[stepIndex];
  const progress = useMemo(() => {
    const total = STEPS.length;
    if (step.key === "welcome") return 0;
    return Math.round(((stepIndex + 1) / total) * 100);
  }, [stepIndex]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === state.accountId) ?? null,
    [accounts, state.accountId]
  );

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === state.categoryId) ?? null,
    [categories, state.categoryId]
  );

  const amountNumber = useMemo(() => parseAmount(state.amount), [state.amount]);

  const progressLine = useMemo(() => {
    if (step.key === "welcome") return "Vamos paso a paso";
    if (step.key === "account" || step.key === "amount") return "Vamos paso a paso";
    if (step.key === "type" || step.key === "category") return "Ya casi está";
    if (step.key === "note") return "Últimos detalles";
    if (step.key === "review") return "Última revisión";
    return "Vamos paso a paso";
  }, [step.key]);

  useEffect(() => {
    if (saved) return;
    if (step.key !== "amount") return;
    const id = window.setTimeout(() => {
      const el = document.getElementById("lab-amount-input") as HTMLInputElement | null;
      el?.focus();
      el?.select?.();
    }, 50);
    return () => window.clearTimeout(id);
  }, [step.key, saved]);

  function canGoNext() {
    if (step.key === "welcome") return true;
    if (step.key === "account") return Boolean(state.accountId);
    if (step.key === "amount") return Boolean(amountNumber && amountNumber > 0);
    if (step.key === "type") return Boolean(state.movementType);
    if (step.key === "category") return Boolean(state.categoryId);
    return true;
  }

  function next() {
    if (!canGoNext()) return;
    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function back() {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }

  function goToWelcome() {
    setSaved(false);
    setSaving(false);
    setStepIndex(0);
  }

  async function simulateSave() {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        mode: "DEMO",
        accountId: state.accountId,
        amount: amountNumber,
        movementType: state.movementType,
        categoryId: state.categoryId,
        note: state.note || null
      };
      // Demo only: do not persist. Keeps existing app logic untouched.
      // eslint-disable-next-line no-console
      console.log("[lab:add-expense] simulated save", payload);
      await new Promise((r) => setTimeout(r, 750));
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function restart() {
    setSaved(false);
    setSaving(false);
    setStepIndex(0);
    setState({
      accountId: null,
      amount: "",
      movementType: "GASTO",
      categoryId: null,
      note: ""
    });
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Laboratorio
          </p>
          <h2 className="mt-1 truncate text-[1.35rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.55rem]">
            Agregar gasto (wizard demo)
          </h2>
        </div>
        <StatPill tone="premium" className="px-3 py-1 text-[10px]">
          DEMO
        </StatPill>
      </div>

      <SurfaceCard
        variant="soft"
        padding="sm"
        className="border border-white/70 bg-white/65 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{step.title}</p>
            <p className="text-xs text-slate-500">
              {step.key === "welcome" ? "Te acompaño en 6 pasos cortos." : `Paso ${stepIndex} de ${STEPS.length - 1}`} ·{" "}
              {progressLine}
            </p>
          </div>
          <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
            {progress}%
          </StatPill>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </SurfaceCard>

      <SurfaceCard
        key={step.key}
        variant="soft"
        padding="md"
        className={cn(
          "animate-fade-up border border-white/70 bg-white/70 shadow-[0_22px_52px_rgba(15,23,42,0.08)] backdrop-blur"
        )}
      >
        {saved ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-3xl bg-emerald-100/80 text-emerald-700 ring-1 ring-white/70">
                <CheckCircle2 className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Listo. Se ve impecable.</p>
                <p className="text-sm text-slate-600">
                  Esto es un demo de UX: no se creó ningún movimiento real en tu cuenta.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" className="rounded-full" onClick={restart}>
                Crear otro demo
              </Button>
              <Button className="rounded-full" onClick={goToWelcome}>
                Volver al inicio del demo
              </Button>
            </div>
          </div>
        ) : step.key === "welcome" ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-3xl bg-violet-100/80 text-violet-700 ring-1 ring-white/70">
                <Sparkles className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-[1.05rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.15rem]">
                  Te ayudo a registrar este gasto en menos de 20 segundos
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Solo lo esencial, paso a paso. Al final verás un resumen antes de confirmar.
                </p>
              </div>
            </div>

            <SurfaceCard variant="soft" padding="sm" className="border border-white/70 bg-white/65">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-white/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Paso 1</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Cuenta</p>
                </div>
                <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-white/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Paso 2</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Monto</p>
                </div>
                <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-white/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Paso 3</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Categoría</p>
                </div>
              </div>
            </SurfaceCard>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button className="rounded-full" onClick={next} disabled={saving}>
                Comenzar
                <ChevronRight className="ml-1.5 h-4 w-4" strokeWidth={2.2} />
              </Button>
            </div>
          </div>
        ) : step.key === "account" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Elige la cuenta desde donde salió el movimiento.
            </p>
            {accountsLoading ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <SurfaceCard variant="soft" padding="sm" className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </SurfaceCard>
                <SurfaceCard variant="soft" padding="sm" className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </SurfaceCard>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {accounts.map((account) => {
                  const isSelected = state.accountId === account.id;
                  const Icon = account.type === "CREDITO" ? CreditCard : Wallet2;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => {
                        setState((s) => ({ ...s, accountId: account.id }));
                        // Auto-advance for selection steps.
                        window.setTimeout(() => next(), 90);
                      }}
                      className={cn(
                        "tap-feedback group rounded-[22px] border p-4 text-left shadow-[0_16px_36px_rgba(15,23,42,0.06)] transition",
                        isSelected
                          ? "border-violet-200 bg-violet-50/80 ring-1 ring-violet-200/60"
                        : "border-white/70 bg-white/70 hover:bg-white"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {account.name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {account.bank ? `${account.bank} · ` : ""}
                            {account.type === "CREDITO" ? "Crédito" : account.type === "DEBITO" ? "Débito" : "Efectivo"}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-3xl ring-1 ring-white/70 transition",
                            isSelected ? "bg-violet-100/80 text-violet-700" : "bg-slate-100/80 text-slate-600"
                          )}
                        >
                          <Icon className="h-5 w-5" strokeWidth={2.1} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : step.key === "amount" ? (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Monto
                </p>
                <p className="mt-1 truncate text-3xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-4xl">
                  {amountNumber ? formatCurrency(amountNumber) : "$0"}
                </p>
              </div>
              {selectedAccount ? (
                <StatPill tone="neutral" className="px-3 py-1 text-[10px]">
                  {selectedAccount.name}
                </StatPill>
              ) : null}
            </div>
            <Input
              id="lab-amount-input"
              inputMode="numeric"
              placeholder="Ej: 15990"
              value={state.amount}
              onChange={(e) => setState((s) => ({ ...s, amount: normalizeAmountInput(e.target.value) }))}
              className="h-12 rounded-2xl text-base"
            />
            <div className="flex flex-wrap gap-2">
              {[5000, 10000, 20000, 50000].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="tap-feedback rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.06)] transition hover:bg-white"
                  onClick={() => setState((s) => ({ ...s, amount: String(value) }))}
                  disabled={saving}
                >
                  {formatCurrency(value)}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Tip: puedes usar un monto rápido y luego ajustarlo si hace falta.
            </p>
          </div>
        ) : step.key === "type" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Elige el tipo para que el resumen tenga sentido.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { key: "GASTO" as const, label: "Gasto", tone: "danger" as const },
                { key: "INGRESO" as const, label: "Ingreso", tone: "success" as const },
                { key: "TRANSFERENCIA" as const, label: "Transferencia", tone: "neutral" as const }
              ].map((option) => {
                const selected = state.movementType === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setState((s) => ({ ...s, movementType: option.key }));
                      window.setTimeout(() => next(), 90);
                    }}
                    className={cn(
                      "tap-feedback rounded-[22px] border px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition",
                      selected ? "border-violet-200 bg-violet-50/80" : "border-white/70 bg-white/70 hover:bg-white"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                      <StatPill tone={option.tone} className="px-2.5 py-1 text-[10px]">
                        {selected ? "Elegido" : " "}
                      </StatPill>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : step.key === "category" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Esto ayuda a entender dónde se va tu plata mes a mes.
            </p>
            {categoriesLoading ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <SurfaceCard key={idx} variant="soft" padding="sm" className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </SurfaceCard>
                ))}
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {categories.map((category) => {
                  const selected = state.categoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setState((s) => ({ ...s, categoryId: category.id }));
                        window.setTimeout(() => next(), 90);
                      }}
                      className={cn(
                        "tap-feedback rounded-[22px] border px-4 py-4 text-left shadow-[0_14px_32px_rgba(15,23,42,0.06)] transition",
                        selected ? "border-violet-200 bg-violet-50/80" : "border-white/70 bg-white/70 hover:bg-white"
                      )}
                    >
                      <p className="truncate text-sm font-semibold text-slate-900">{category.name}</p>
                      <p className="mt-1 text-xs text-slate-500">Categoría</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : step.key === "note" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Si quieres, deja un detalle para acordarte después.
            </p>
            <textarea
              className={cn(
                "w-full rounded-[22px] border border-white/70 bg-white/70 px-4 py-3 text-sm text-slate-900 shadow-[0_14px_32px_rgba(15,23,42,0.06)] outline-none transition",
                "placeholder:text-slate-400 focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
              )}
              rows={5}
              placeholder="Ej: almuerzo con clientes, notaría, etc."
              value={state.note}
              onChange={(e) => setState((s) => ({ ...s, note: e.target.value }))}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">Antes de confirmar</p>
              <StatPill tone="neutral" className="px-3 py-1 text-[10px]">
                DEMO
              </StatPill>
            </div>

            <SurfaceCard variant="soft" padding="sm" className="border border-white/70 bg-white/70">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Cuenta</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedAccount ? selectedAccount.name : "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {selectedAccount?.bank ? `${selectedAccount.bank} · ` : ""}
                    {selectedAccount?.type === "CREDITO"
                      ? "Crédito"
                      : selectedAccount?.type === "DEBITO"
                        ? "Débito"
                        : selectedAccount
                          ? "Efectivo"
                          : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Monto</p>
                  <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
                    {amountNumber ? formatCurrency(amountNumber) : "$0"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {state.movementType === "GASTO"
                      ? "Gasto"
                      : state.movementType === "INGRESO"
                        ? "Ingreso"
                        : state.movementType === "TRANSFERENCIA"
                          ? "Transferencia"
                          : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Categoría</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedCategory ? selectedCategory.name : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Nota</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-700">
                    {state.note.trim() ? state.note.trim() : "Sin nota"}
                  </p>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard variant="soft" padding="sm" className="border border-amber-200/80 bg-amber-50/70 text-amber-800">
              <p className="text-sm font-medium">
                Demo: al confirmar solo simulamos el guardado (no se crea ningún movimiento real).
              </p>
            </SurfaceCard>
          </div>
        )}

        {!saved ? (
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="secondary"
              className="rounded-full"
              onClick={back}
              disabled={stepIndex === 0 || saving}
            >
              <ChevronLeft className="mr-1.5 h-4 w-4" strokeWidth={2.2} />
              Volver
            </Button>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {step.key === "review" ? (
                <Button
                  className="rounded-full"
                  onClick={simulateSave}
                  disabled={saving || !state.accountId || !amountNumber || !state.categoryId || !state.movementType}
                >
                  {saving ? "Guardando…" : "Confirmar (demo)"}
                  <ChevronRight className="ml-1.5 h-4 w-4" strokeWidth={2.2} />
                </Button>
              ) : (
                <Button className="rounded-full" onClick={next} disabled={!canGoNext() || saving}>
                  Continuar
                  <ChevronRight className="ml-1.5 h-4 w-4" strokeWidth={2.2} />
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </SurfaceCard>
    </div>
  );
}
