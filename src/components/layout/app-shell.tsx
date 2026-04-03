"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, Plus } from "lucide-react";
import { navigationItems } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { StatPill } from "@/components/ui/stat-pill";
import { DashboardHeaderLoader } from "@/components/layout/dashboard-header-loader";
import { DashboardHeaderProvider, useDashboardHeader } from "@/components/layout/dashboard-header-context";
import { NewTransactionModal } from "@/components/movimientos/new-transaction-modal";
import { CalculatorWidget } from "@/components/inicio/calculator-widget";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useCallback, useState } from "react";

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

  return (
    <div className="min-h-screen">
      <DashboardHeaderLoader />
      <div className="screen-shell">
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
                <StatPill tone="neutral" className="hidden px-2.5 py-1 text-[10px] sm:inline-flex">
                  Personal
                </StatPill>
              </div>
            </div>
          </header>

          <main className="pb-24 sm:pb-28">
            <PageContainer size="wide">{children}</PageContainer>
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

        <NewTransactionModal
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
