"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { appConfig } from "@/lib/config/app-config";
import { navigationItems } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { BusinessUnitSelector } from "@/components/layout/business-unit-selector";
import { Select } from "@/components/ui/select";
import { fetchAuthSession } from "@/shared/lib/auth-session-client";
import type { AuthSessionResponse } from "@/shared/types/auth";

function BusinessUnitSelectorFallback() {
  const defaultUnit = appConfig.businessUnits[0];
  return (
    <Select className="h-10 min-w-[150px] text-xs sm:min-w-[170px] sm:text-sm" defaultValue={defaultUnit.id}>
      <option value={defaultUnit.id}>{defaultUnit.name}</option>
    </Select>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(null);
  const visibleNavigationItems = navigationItems.filter((item) =>
    "hidden" in item ? !item.hidden : true
  );

  async function refreshSession() {
    try {
      const session = await fetchAuthSession();
      setAuthSession(session);
    } catch {
      setAuthSession({ authenticated: false });
    }
  }

  useEffect(() => {
    void refreshSession();
  }, []);

  return (
    <div className="min-h-screen bg-hero-glow">
      <div className="screen-shell">
        <div className="lg:pl-[120px]">
          <header className="glass-panel sticky top-3 z-20 mb-4 rounded-[28px] px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/55">
                    Mis Finanzas · Modo simple
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Gastos y deudas</h1>
                    <span className="rounded-full border border-white/70 bg-white/75 px-2.5 py-1 text-[10px] font-medium text-neutral-600">
                      {authSession?.authenticated === true
                        ? `Workspace: ${authSession.activeWorkspace?.workspaceName ?? "sin seleccionar"}`
                        : "Modo prueba"}
                    </span>
                  </div>
                </div>
                <div className="hidden items-center gap-3 sm:flex">
                  <Link
                    href="/movimientos"
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-9 px-3 text-xs font-semibold")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar gasto
                  </Link>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <Suspense fallback={<BusinessUnitSelectorFallback />}>
                  <BusinessUnitSelector />
                </Suspense>
                <div className="grid grid-cols-1 gap-3 sm:hidden">
                  <Link
                    href="/movimientos"
                    className={cn(buttonVariants({ variant: "secondary" }), "h-10 text-xs font-semibold")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar gasto
                  </Link>
                </div>
              </div>
            </div>
          </header>

          <main className="pb-24">{children}</main>
        </div>

        <nav className="glass-panel fixed inset-x-4 bottom-4 z-30 rounded-[30px] border-white/50 bg-white/68 p-2 shadow-[0_12px_28px_rgba(15,23,42,0.12)] lg:inset-x-auto lg:left-6 lg:top-1/2 lg:h-fit lg:w-[92px] lg:-translate-y-1/2">
          <div className="grid grid-cols-5 gap-2 lg:grid-cols-1">
            {visibleNavigationItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-[22px] px-2 py-3 text-[11px] font-medium transition-colors",
                    isActive
                      ? "bg-primary/92 text-white shadow-[0_8px_18px_rgba(15,61,62,0.25)]"
                      : "text-neutral-500 hover:bg-white/55 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
