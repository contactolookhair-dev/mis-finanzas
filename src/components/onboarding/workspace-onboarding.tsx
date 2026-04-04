"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, CircleDashed, Sparkles, WalletCards } from "lucide-react";
import type { AuthSessionResponse } from "@/shared/types/auth";
import { fetchAuthSession } from "@/shared/lib/auth-session-client";
import { Button } from "@/components/ui/button";
import { StatPill } from "@/components/ui/stat-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

function onboardingKey(workspaceId: string | null) {
  return workspaceId
    ? `mis-finanzas.onboarding.workspace.${workspaceId}.dismissed.v1`
    : "mis-finanzas.onboarding.workspace.unknown.dismissed.v1";
}

type Step = {
  title: string;
  description: string;
  complete: boolean;
  actionLabel: string;
  onAction: () => void;
};

export function WorkspaceOnboarding({
  accountsCount,
  movementsCount,
  onOpenNewMovement,
  onDismissedChange
}: {
  accountsCount: number;
  movementsCount: number;
  onOpenNewMovement: () => void;
  onDismissedChange?: (next: { dismissed: boolean; workspaceId: string | null }) => void;
}) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const session = (await fetchAuthSession()) as AuthSessionResponse;
        if (!mounted) return;
        if (session.authenticated === true) {
          setWorkspaceId(session.activeWorkspace?.workspaceId ?? null);
        } else {
          setWorkspaceId(null);
        }
      } catch {
        setWorkspaceId(null);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const raw = window.localStorage.getItem(onboardingKey(workspaceId));
      setDismissed(raw === "dismissed");
    } catch {
      setDismissed(false);
    }
  }, [hydrated, workspaceId]);

  useEffect(() => {
    onDismissedChange?.({ dismissed, workspaceId });
  }, [dismissed, onDismissedChange, workspaceId]);

  const isEmptyWorkspace = accountsCount === 0 && movementsCount === 0;
  const done = accountsCount > 0 && movementsCount > 0;

  const steps = useMemo<Step[]>(
    () => [
      {
        title: "Crea tu primera cuenta",
        description: "Billetera, banco o tarjeta. Es la base para registrar todo lo demás.",
        complete: accountsCount > 0,
        actionLabel: "Crear cuenta",
        onAction: () => router.push("/cuentas?create=1")
      },
      {
        title: "Registra tu primer movimiento",
        description: "Anota un gasto o ingreso para que tu dashboard empiece a vivir.",
        complete: movementsCount > 0,
        actionLabel: "Crear movimiento",
        onAction: () => onOpenNewMovement()
      }
    ],
    [accountsCount, movementsCount, onOpenNewMovement, router]
  );

  const completed = steps.filter((s) => s.complete).length;
  const progressPct = Math.round((completed / steps.length) * 100);

  useEffect(() => {
    if (!hydrated) return;
    if (!done) return;
    try {
      window.localStorage.setItem(onboardingKey(workspaceId), "dismissed");
    } catch {
      // noop
    }
    setDismissed(true);
  }, [done, hydrated, workspaceId]);

  const handleSkip = () => {
    try {
      window.localStorage.setItem(onboardingKey(workspaceId), "dismissed");
    } catch {
      // noop
    }
    setDismissed(true);
  };

  if (!hydrated) return null;
  const shouldShow = !dismissed && !(accountsCount > 0 && movementsCount > 0);
  if (!shouldShow) return null;

  return (
    <SurfaceCard variant="highlight" className="relative overflow-hidden animate-fade-up">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(15,23,42,0.045),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.06),transparent_32%)]" />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              Bienvenida
            </p>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.3rem]">
              Dejemos este workspace listo en 2 pasos
            </h2>
            <p className="max-w-xl text-sm leading-6 text-slate-500">
              Crea tu primera cuenta y registra un movimiento. Luego verás tu dashboard con datos reales.
            </p>
          </div>
          <StatPill tone="premium" icon={<Sparkles className="h-3.5 w-3.5" />}>
            {progressPct}% listo
          </StatPill>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {steps.map((step) => {
            const Icon = step.complete ? CheckCircle2 : CircleDashed;
            return (
              <button
                key={step.title}
                type="button"
                onClick={step.onAction}
                className={cn(
                  "interactive-lift w-full rounded-[22px] border border-border/80 bg-white/78 p-4 text-left transition hover:bg-white",
                  step.complete && "border-emerald-100 bg-emerald-50/70"
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-current",
                      step.complete ? "border-emerald-200 bg-white text-emerald-700" : "border-slate-200 bg-white text-slate-600"
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{step.description}</p>
                    <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                      {step.actionLabel}
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
            onClick={handleSkip}
          >
            Saltar por ahora
          </button>
          <Button
            type="button"
            variant="secondary"
            className="h-10 rounded-full px-4"
            onClick={() => router.push("/importaciones")}
          >
            <WalletCards className="mr-2 h-4 w-4" strokeWidth={1.9} />
            Importar datos
          </Button>
        </div>
      </div>
    </SurfaceCard>
  );
}
