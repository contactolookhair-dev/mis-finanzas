"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, CircleDashed, Sparkles, Wallet2, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

const ONBOARDING_STORAGE_KEY = "mis-finanzas.onboarding.dismissed.v1";

type OnboardingBannerProps = {
  accountsCount: number;
  movementsCount: number;
  insightsReady: boolean;
};

type OnboardingStep = {
  title: string;
  description: string;
  complete: boolean;
  actionLabel: string;
  onAction: () => void;
  tone: "sky" | "cyan" | "emerald";
};

const toneClasses: Record<OnboardingStep["tone"], string> = {
  sky: "border-sky-100 bg-sky-50/70 text-sky-700",
  cyan: "border-cyan-100 bg-cyan-50/70 text-cyan-700",
  emerald: "border-emerald-100 bg-emerald-50/70 text-emerald-700"
};

export function OnboardingBanner({
  accountsCount,
  movementsCount,
  insightsReady
}: OnboardingBannerProps) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setHydrated(true);
    try {
      const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
      setDismissed(raw === "dismissed");
    } catch {
      setDismissed(false);
    }
  }, []);

  const steps = useMemo<OnboardingStep[]>(
    () => [
      {
        title: "Crear tu primera cuenta",
        description: "Agrega tu billetera, tarjeta o efectivo para empezar con una base clara.",
        complete: accountsCount > 0,
        actionLabel: "Ir a Cuentas",
        onAction: () => router.push("/cuentas"),
        tone: "sky"
      },
      {
        title: "Registrar tu primer movimiento",
        description: "Anota un gasto o ingreso para que el sistema empiece a leer tu realidad.",
        complete: movementsCount > 0,
        actionLabel: "Ir a Movimientos",
        onAction: () => router.push("/movimientos"),
        tone: "cyan"
      },
      {
        title: "Ver tu primer resumen útil",
        description: "Revisa tu saldo, salud financiera e insights básicos en una sola vista.",
        complete: insightsReady,
        actionLabel: "Ir a Resumen",
        onAction: () => router.push("/resumen"),
        tone: "emerald"
      }
    ],
    [accountsCount, insightsReady, movementsCount, router]
  );

  const completedSteps = steps.filter((step) => step.complete).length;
  const progress = completedSteps / steps.length;
  const shouldHide = !hydrated || dismissed || progress >= 1;

  useEffect(() => {
    if (!hydrated || progress < 1) return;
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "dismissed");
    } catch {
      // noop
    }
    setDismissed(true);
  }, [hydrated, progress]);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "dismissed");
    } catch {
      // noop
    }
    setDismissed(true);
  };

  const handleDemo = () => {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "dismissed");
    } catch {
      // noop
    }
    router.push("/configuracion#demo");
  };

  const handleStartFromScratch = () => {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "dismissed");
    } catch {
      // noop
    }
    router.push("/cuentas");
  };

  if (shouldHide) return null;

  return (
    <SurfaceCard variant="highlight" className="relative overflow-hidden animate-fade-up">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.08),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.07),transparent_32%)]" />
      <div className="relative grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/70">
                Bienvenida
              </p>
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.3rem]">
                Empieza en pocos pasos y llega rápido a tu primer valor
              </h2>
              <p className="max-w-xl text-sm leading-6 text-slate-500">
                Te ayudamos a elegir cómo partir, crear tu primera cuenta, registrar tu primer
                movimiento y ver un resumen útil sin perder tiempo.
              </p>
            </div>
            <StatPill tone="premium" icon={<Sparkles className="h-3.5 w-3.5" />}>
              {Math.round(progress * 100)}% listo
            </StatPill>
          </div>

          <div className="rounded-[24px] border border-white/80 bg-white/78 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-2">
              <Wallet2 className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Elige tu punto de partida
              </p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                onClick={handleDemo}
                className="tap-feedback h-11 rounded-2xl bg-gradient-to-r from-primary via-secondary to-accent px-4 text-sm font-semibold"
              >
                Usar demo
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="tap-feedback h-11 rounded-2xl border border-border/80 px-4 text-sm font-semibold"
                onClick={handleStartFromScratch}
              >
                Empezar desde cero
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
                onClick={handleDismiss}
              >
                Saltar onboarding
              </button>
              <span className="text-[11px] text-slate-400">
                Puedes volver a usar demo cuando quieras desde Configuración.
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-[24px] border border-white/80 bg-white/82 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Checklist inicial
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Completa estos pasos para dejar la app lista para usar.
                </p>
              </div>
              <StatPill tone="neutral">{completedSteps}/3</StatPill>
            </div>

            <div className="mt-4 space-y-2.5">
              {steps.map((step) => {
                const Icon = step.complete ? CheckCircle2 : CircleDashed;
                return (
                  <button
                    key={step.title}
                    type="button"
                    onClick={step.onAction}
                    className={cn(
                      "interactive-lift w-full rounded-[22px] border p-3.5 text-left transition",
                      step.complete
                        ? toneClasses[step.tone]
                        : "border-border/80 bg-white/72 text-slate-900 hover:border-primary/15 hover:bg-white"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-current",
                          step.complete ? "border-current/10 bg-white/80" : "border-border/80 bg-white/90"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold tracking-[-0.02em]">{step.title}</p>
                          {step.complete ? (
                            <StatPill tone="success" className="shrink-0">
                              Listo
                            </StatPill>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                              {step.actionLabel}
                              <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{step.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-dashed border-primary/15 bg-white/72 p-4">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Primer valor
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Cuando tengas una cuenta y un movimiento, verás saldos, salud financiera y
              recomendaciones en el dashboard.
            </p>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
