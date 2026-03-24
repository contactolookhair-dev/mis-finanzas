"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RefreshCcw, Upload } from "lucide-react";
import { appConfig } from "@/lib/config/app-config";
import { navigationItems } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BusinessUnitSelector } from "@/components/layout/business-unit-selector";
import { Select } from "@/components/ui/select";
import { fetchAuthSession } from "@/shared/lib/auth-session-client";
import type { AuthSessionResponse } from "@/shared/types/auth";

function BusinessUnitSelectorFallback() {
  const defaultUnit = appConfig.businessUnits[0];
  return (
    <Select className="min-w-[180px]" defaultValue={defaultUnit.id}>
      <option value={defaultUnit.id}>{defaultUnit.name}</option>
    </Select>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(null);

  useEffect(() => {
    async function loadAuthSession() {
      try {
        const session = await fetchAuthSession();
        setAuthSession(session);
      } catch {
        setAuthSession({ authenticated: false });
      }
    }

    void loadAuthSession();
  }, []);

  return (
    <div className="min-h-screen bg-hero-glow">
      <div className="screen-shell">
        <header className="glass-panel sticky top-4 z-20 mb-6 rounded-[30px] px-4 py-4 shadow-card">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/70">
                  Chile · Finanzas híbridas
                </p>
                <h1 className="mt-1 text-xl font-semibold sm:text-2xl">Mis Finanzas</h1>
                <p className="mt-1 text-xs text-neutral-500">
                  {authSession?.authenticated === true
                    ? `Workspace: ${authSession.activeWorkspace?.workspaceName ?? "sin seleccionar"}`
                    : "Sesion no iniciada"}
                </p>
              </div>
              <div className="hidden items-center gap-3 sm:flex">
                <Button variant="secondary" size="icon" aria-label="Refrescar">
                  <RefreshCcw className="h-4 w-4" />
                </Button>
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Subir cartola
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Suspense fallback={<BusinessUnitSelectorFallback />}>
                <BusinessUnitSelector />
              </Suspense>
              <div className="grid grid-cols-2 gap-3 sm:hidden">
                <Button variant="secondary">
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Refrescar
                </Button>
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Subir
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="pb-24">{children}</main>

        <nav className="glass-panel fixed inset-x-4 bottom-4 z-30 rounded-[30px] p-2 shadow-card lg:inset-x-auto lg:left-6 lg:top-1/2 lg:h-fit lg:w-[92px] lg:-translate-y-1/2">
          <div className="grid grid-cols-5 gap-2 lg:grid-cols-1">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-[22px] px-2 py-3 text-[11px] font-medium transition",
                    isActive
                      ? "bg-primary text-white"
                      : "text-neutral-500 hover:bg-white/70 hover:text-foreground"
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
