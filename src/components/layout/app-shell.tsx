"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Calculator, CheckCircle2, Plus } from "lucide-react";
import { navigationItems } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { StatPill } from "@/components/ui/stat-pill";
import { DashboardHeaderLoader } from "@/components/layout/dashboard-header-loader";
import { DashboardHeaderProvider, useDashboardHeader } from "@/components/layout/dashboard-header-context";
import { TransactionEntryModal } from "@/components/movimientos/transaction-entry-modal";
import { CalculatorWidget } from "@/components/inicio/calculator-widget";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useCallback, useEffect, useState } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { useWorkspaceStore } from "@/shared/stores/workspace-store";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <DashboardHeaderProvider>
      <AppShellFrame>{children}</AppShellFrame>
    </DashboardHeaderProvider>
  );
}

function AppShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { metric } = useDashboardHeader();
  const visibleNavigationItems = navigationItems.filter((item) =>
    "hidden" in item ? !item.hidden : true
  );

  const [transactionOpen, setTransactionOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorInput, setCalculatorInput] = useState("");
  const [calculatorResult, setCalculatorResult] = useState<number | null>(null);
  const [workspaceSwitching, setWorkspaceSwitching] = useState(false);
  const [workspaceToast, setWorkspaceToast] = useState<{
    tone: "success" | "danger";
    message: string;
    workspaceName?: string | null;
  } | null>(null);

  const evaluateExpression = useCallback((value: string) => {
    if (!value.trim()) return null;
    const sanitized = value.replace(/[^0-9.+\-*/() ]/g, "");
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${sanitized}`)();
      return typeof result === "number" && Number.isFinite(result) ? result : null;
    } catch {
      return null;
    }
  }, []);

  const handleCalculatorEquals = useCallback(() => {
    setCalculatorResult(evaluateExpression(calculatorInput));
  }, [calculatorInput, evaluateExpression]);

  const handleCalculatorClear = useCallback(() => {
    setCalculatorInput("");
    setCalculatorResult(null);
  }, []);

  const handleCalculatorDelete = useCallback(() => {
    setCalculatorInput((prev) => prev.slice(0, -1));
  }, []);

  const handleCalculatorAppend = useCallback((symbol: string) => {
    setCalculatorInput((prev) => `${prev}${symbol}`);
  }, []);

  const metricToneClass =
    metric?.tone === "negative"
      ? "text-rose-600"
      : metric?.tone === "positive"
        ? "text-emerald-600"
        : "text-slate-900";

  useEffect(() => {
    function onWorkspaceSwitch(event: Event) {
      const detail = (event as CustomEvent).detail as
        | { status: "start" | "success" | "error"; workspaceName?: string | null }
        | undefined;
      if (!detail) return;

      if (detail.status === "start") {
        setWorkspaceSwitching(true);
        return;
      }

      setWorkspaceSwitching(false);
      if (detail.status === "success") {
        setWorkspaceToast({
          tone: "success",
          message: "Perfil cambiado",
          workspaceName: detail.workspaceName ?? null
        });
      } else if (detail.status === "error") {
        setWorkspaceToast({
          tone: "danger",
          message: "No se pudo cambiar"
        });
      }
    }

    window.addEventListener("mis-finanzas:workspace-switch", onWorkspaceSwitch as EventListener);
    return () => {
      window.removeEventListener("mis-finanzas:workspace-switch", onWorkspaceSwitch as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!workspaceToast) return;
    const timer = window.setTimeout(() => setWorkspaceToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [workspaceToast]);

  return (
    <div className="min-h-screen">
      <DashboardHeaderLoader />
      <div className="screen-shell">
        {workspaceSwitching ? (
          <div className="fixed left-0 right-0 top-0 z-[90] h-1 bg-gradient-to-r from-slate-900 via-primary to-emerald-500 animate-pulse" />
        ) : null}

        {workspaceToast ? (
          <div className="fixed left-1/2 top-4 z-[91] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:top-6">
            <SurfaceCard
              variant="soft"
              padding="sm"
              className={cn(
                "animate-fade-up border shadow-[0_18px_40px_rgba(15,23,42,0.12)]",
                workspaceToast.tone === "success"
                  ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
                  : "border-rose-200/80 bg-rose-50/80 text-rose-700"
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl ring-1 ring-white/60",
                    workspaceToast.tone === "success"
                      ? "bg-emerald-100/80 text-emerald-700"
                      : "bg-rose-100/80 text-rose-700"
                  )}
                >
                  {workspaceToast.tone === "success" ? (
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} />
                  ) : (
                    <AlertTriangle className="h-4 w-4" strokeWidth={2.2} />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{workspaceToast.message}</p>
                  {workspaceToast.tone === "success" && workspaceToast.workspaceName ? (
                    <p className="truncate text-xs text-emerald-700/80">
                      {workspaceToast.workspaceName}
                    </p>
                  ) : null}
                </div>
              </div>
            </SurfaceCard>
          </div>
        ) : null}

        <div className="lg:pl-[120px]">
          <header className="glass-surface sticky top-2 z-20 mb-4 rounded-[18px] px-3.5 py-2.5 ring-1 ring-white/35 sm:top-3 sm:mb-5 sm:px-4 sm:py-3">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.1rem]">
                Tu dinero hoy
              </h1>
              <div className="flex items-center gap-2">
                <p
                  className={cn(
                    "text-[1.05rem] font-semibold tracking-[-0.03em] sm:text-[1.1rem]",
                    metric ? metricToneClass : "text-slate-400"
                  )}
                >
                  {metric ? metric.value : "—"}
                </p>
                <WorkspaceSwitcher />
                <UserMenu className="ml-1" />
              </div>
            </div>
          </header>

          <main
            className={cn(
              "relative pb-24 transition-[opacity,transform,filter] duration-200 ease-out sm:pb-28",
              workspaceSwitching && "opacity-45 pointer-events-none select-none translate-y-[1px] blur-[0.25px]"
            )}
            aria-busy={workspaceSwitching}
          >
            {workspaceSwitching ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-[26px]"
              >
                <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px]" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-70 animate-shimmer" />
              </div>
            ) : null}
            {workspaceSwitching ? (
              <div aria-hidden className="pointer-events-none absolute inset-0">
                <WorkspaceSwitchSkeleton />
              </div>
            ) : null}
            <PageContainer size="wide">
              <WorkspaceReactiveBoundary>{children}</WorkspaceReactiveBoundary>
            </PageContainer>
          </main>
        </div>

        <nav className="glass-surface fixed inset-x-4 bottom-4 z-30 rounded-[28px] p-2 ring-1 ring-white/30 lg:inset-x-auto lg:left-6 lg:top-1/2 lg:h-fit lg:w-[94px] lg:-translate-y-1/2">
          {/* Mobile: single-row carousel to avoid taking extra height when there are many items.
              Desktop: keep vertical nav. */}
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-0.5 py-0.5 lg:grid lg:grid-cols-1 lg:snap-none lg:overflow-visible lg:px-0 lg:py-0">
            {visibleNavigationItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex-none snap-start",
                    "group flex flex-col items-center justify-center gap-1.5 rounded-[22px] px-2.5 py-3 text-[11px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    "min-w-[76px] lg:min-w-0 lg:w-auto",
                    isActive
                      ? "bg-primary text-white shadow-[0_8px_18px_rgba(37,99,235,0.28)]"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-2xl transition-all duration-200",
                      isActive
                        ? "bg-white/15 text-white shadow-[0_6px_14px_rgba(15,23,42,0.08)]"
                        : "bg-slate-100/80 text-slate-500 group-hover:bg-white group-hover:text-primary"
                    )}
                  >
                    <Icon className="h-[15px] w-[15px]" strokeWidth={1.9} />
                  </span>
                  <span className="truncate tracking-[0.01em]">{item.label}</span>
                  {isActive ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-white/90 shadow-[0_0_0_3px_rgba(255,255,255,0.15)]" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Desktop floating quick actions (mobile already has its own patterns). */}
        <div className="fixed bottom-6 right-6 z-30 hidden flex-col gap-2 sm:flex">
          <Button
            type="button"
            onClick={() => setCalculatorOpen(true)}
            variant="secondary"
            className="h-11 w-11 rounded-full p-0 shadow-[0_18px_38px_rgba(15,23,42,0.14)]"
            aria-label="Calculadora"
          >
            <Calculator className="h-5 w-5" strokeWidth={1.9} />
          </Button>
          <Button
            type="button"
            onClick={() => setTransactionOpen(true)}
            className="h-12 w-12 rounded-full p-0 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_22px_46px_rgba(37,99,235,0.18)] ring-1 ring-white/30 hover:brightness-105"
            aria-label="Agregar gasto"
          >
            <Plus className="h-5 w-5" strokeWidth={2.2} />
          </Button>
        </div>

        <TransactionEntryModal
          open={transactionOpen}
          onOpenChange={setTransactionOpen}
          onSuccess={() => {
            try {
              window.dispatchEvent(new Event("mis-finanzas:accounts-changed"));
            } catch {
              // noop
            }
          }}
        />

        {calculatorOpen ? (
          <div className="fixed inset-0 z-[72] flex items-end justify-center bg-slate-950/36 p-0 sm:items-center sm:p-4">
            <div className="glass-surface safe-pb w-full max-h-[88vh] overflow-y-auto rounded-t-[28px] p-4 animate-fade-up ring-1 ring-white/35 sm:max-w-md sm:rounded-[32px] sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Calculadora
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">Calcula sin salir</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCalculatorOpen(false)}
                  className="tap-feedback rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                  aria-label="Cerrar calculadora"
                >
                  <Plus className="h-4 w-4 rotate-45" />
                </button>
              </div>
              <SurfaceCard variant="soft" padding="sm" className="shadow-none">
                <CalculatorWidget
                  calculatorInput={calculatorInput}
                  calculatorResult={calculatorResult}
                  onAppend={handleCalculatorAppend}
                  onClear={handleCalculatorClear}
                  onDelete={handleCalculatorDelete}
                  onEquals={handleCalculatorEquals}
                  compact
                />
              </SurfaceCard>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WorkspaceSwitchSkeleton() {
  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 grid gap-3 sm:mb-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-[22px] border border-white/70 bg-white/60 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="h-3 w-24 rounded-full bg-slate-200/80 animate-shimmer" />
            <div className="mt-3 h-8 w-40 rounded-2xl bg-slate-200/80 animate-shimmer" />
            <div className="mt-4 h-3 w-28 rounded-full bg-slate-200/70 animate-shimmer" />
          </div>
          <div className="rounded-[22px] border border-white/70 bg-white/60 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="h-3 w-28 rounded-full bg-slate-200/80 animate-shimmer" />
            <div className="mt-3 h-8 w-36 rounded-2xl bg-slate-200/80 animate-shimmer" />
            <div className="mt-4 h-3 w-24 rounded-full bg-slate-200/70 animate-shimmer" />
          </div>
          <div className="hidden rounded-[22px] border border-white/70 bg-white/60 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur lg:block">
            <div className="h-3 w-20 rounded-full bg-slate-200/80 animate-shimmer" />
            <div className="mt-3 h-8 w-44 rounded-2xl bg-slate-200/80 animate-shimmer" />
            <div className="mt-4 h-3 w-32 rounded-full bg-slate-200/70 animate-shimmer" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-white/70 bg-white/55 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)] backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded-full bg-slate-200/80 animate-shimmer" />
              <div className="h-6 w-20 rounded-full bg-slate-200/70 animate-shimmer" />
            </div>
            <div className="mt-4 space-y-2.5">
              <div className="h-3 w-5/6 rounded-full bg-slate-200/70 animate-shimmer" />
              <div className="h-3 w-2/3 rounded-full bg-slate-200/70 animate-shimmer" />
              <div className="h-3 w-3/4 rounded-full bg-slate-200/70 animate-shimmer" />
            </div>
          </div>
          <div className="rounded-[22px] border border-white/70 bg-white/55 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)] backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="h-3 w-28 rounded-full bg-slate-200/80 animate-shimmer" />
              <div className="h-6 w-16 rounded-full bg-slate-200/70 animate-shimmer" />
            </div>
            <div className="mt-4 space-y-2.5">
              <div className="h-3 w-4/5 rounded-full bg-slate-200/70 animate-shimmer" />
              <div className="h-3 w-2/3 rounded-full bg-slate-200/70 animate-shimmer" />
              <div className="h-3 w-3/5 rounded-full bg-slate-200/70 animate-shimmer" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceReactiveBoundary({ children }: { children: ReactNode }) {
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  // Force remount of client trees that fetch via /api (cookie-based workspace) when the active workspace changes.
  // This makes the app feel reactive without requiring router.refresh().
  return <div key={workspaceId ?? "no-workspace"}>{children}</div>;
}
