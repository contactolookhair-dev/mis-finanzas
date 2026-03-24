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
    <Select className="h-10 min-w-[150px] text-xs sm:min-w-[170px] sm:text-sm" defaultValue={defaultUnit.id}>
      <option value={defaultUnit.id}>{defaultUnit.name}</option>
    </Select>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [authSession, setAuthSession] = useState<AuthSessionResponse | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginUserKey, setLoginUserKey] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

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

  async function handleDevLogin() {
    if (!loginUserKey.trim()) {
      setLoginError("Ingresa un identificador para iniciar sesión.");
      return;
    }

    try {
      setLoginLoading(true);
      setLoginError(null);
      const response = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userKey: loginUserKey.trim(),
          displayName: loginName.trim() || undefined
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "No se pudo iniciar sesión.");
      }

      await refreshSession();
      setShowLogin(false);
      setLoginUserKey("");
      setLoginName("");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo iniciar sesión.");
    } finally {
      setLoginLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-hero-glow">
      <div className="screen-shell">
        <div className="lg:pl-[120px]">
          <header className="glass-panel sticky top-3 z-20 mb-4 rounded-[28px] px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/55">
                    Chile · Finanzas híbridas
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Mis Finanzas</h1>
                    <span className="rounded-full border border-white/70 bg-white/75 px-2.5 py-1 text-[10px] font-medium text-neutral-600">
                      {authSession?.authenticated === true
                        ? `Workspace: ${authSession.activeWorkspace?.workspaceName ?? "sin seleccionar"}`
                        : "Sesión no iniciada"}
                    </span>
                    {authSession?.authenticated !== true ? (
                      <Button
                        variant="secondary"
                        className="h-7 px-2.5 text-[11px] font-semibold"
                        onClick={() => setShowLogin((value) => !value)}
                      >
                        Iniciar sesión
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="hidden items-center gap-3 sm:flex">
                  <Button variant="secondary" size="icon" aria-label="Refrescar">
                    <RefreshCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" className="h-9 px-3 text-xs font-semibold">
                    <Upload className="mr-2 h-4 w-4" />
                    Subir cartola
                  </Button>
                </div>
              </div>

              {authSession?.authenticated !== true && showLogin ? (
                <div className="rounded-[22px] border border-white/70 bg-white/75 p-3 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      value={loginUserKey}
                      onChange={(event) => setLoginUserKey(event.target.value)}
                      placeholder="Usuario o correo"
                      className="h-10 rounded-2xl border border-white/70 bg-white/90 px-3 text-xs outline-none focus:border-primary sm:text-sm"
                    />
                    <input
                      value={loginName}
                      onChange={(event) => setLoginName(event.target.value)}
                      placeholder="Nombre visible (opcional)"
                      className="h-10 rounded-2xl border border-white/70 bg-white/90 px-3 text-xs outline-none focus:border-primary sm:text-sm"
                    />
                    <Button
                      variant="secondary"
                      className="h-10 text-xs font-semibold"
                      onClick={handleDevLogin}
                      disabled={loginLoading}
                    >
                      {loginLoading ? "Entrando..." : "Continuar"}
                    </Button>
                  </div>
                  {loginError ? <p className="mt-2 text-xs text-rose-600">{loginError}</p> : null}
                  <p className="mt-2 text-[11px] text-neutral-500">
                    Este acceso usa el login de desarrollo si está habilitado en el entorno.
                  </p>
                </div>
              ) : null}

              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <Suspense fallback={<BusinessUnitSelectorFallback />}>
                  <BusinessUnitSelector />
                </Suspense>
                <div className="grid grid-cols-2 gap-3 sm:hidden">
                  <Button variant="secondary" className="h-10 text-xs">
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refrescar
                  </Button>
                  <Button variant="secondary" className="h-10 text-xs font-semibold">
                    <Upload className="mr-2 h-4 w-4" />
                    Subir
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <main className="pb-24">{children}</main>
        </div>

        <nav className="glass-panel fixed inset-x-4 bottom-4 z-30 rounded-[30px] border-white/50 bg-white/68 p-2 shadow-[0_12px_28px_rgba(15,23,42,0.12)] lg:inset-x-auto lg:left-6 lg:top-1/2 lg:h-fit lg:w-[92px] lg:-translate-y-1/2">
          <div className="grid grid-cols-5 gap-2 lg:grid-cols-1">
            {navigationItems.map((item) => {
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
