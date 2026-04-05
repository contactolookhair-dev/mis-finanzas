"use client";

import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import type { AuthSessionResponse } from "@/shared/types/auth";
import { fetchAuthSession } from "@/shared/lib/auth-session-client";
import { cn } from "@/lib/utils";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatPill } from "@/components/ui/stat-pill";
import { useWorkspaceStore } from "@/shared/stores/workspace-store";

function initialsFromWorkspace(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "W";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${second}`.toUpperCase();
}

type CreateWorkspaceResponse =
  | { message: string; workspaceId: string; workspaceName: string; workspaceSlug: string }
  | { message?: string };

export function WorkspaceSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setWorkspace = useWorkspaceStore((state) => state.setWorkspace);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<string | null>(null);
  const [optimisticWorkspace, setOptimisticWorkspace] = useState<{ id: string; name: string } | null>(null);

  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeWorkspaceName =
    session?.authenticated === true ? session.activeWorkspace?.workspaceName ?? "Sin workspace" : "—";

  const activeWorkspaceId =
    session?.authenticated === true ? session.activeWorkspace?.workspaceId ?? null : null;

  const memberships =
    session?.authenticated === true ? session.memberships ?? [] : [];

  const displayedWorkspaceName = optimisticWorkspace?.name ?? activeWorkspaceName;
  const displayedWorkspaceId = optimisticWorkspace?.id ?? activeWorkspaceId;

  const hasMultiple = memberships.length > 1;
  const badgeText = useMemo(() => initialsFromWorkspace(displayedWorkspaceName), [displayedWorkspaceName]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const s = await fetchAuthSession();
        setSession(s);
        if (s.authenticated === true && s.activeWorkspace) {
          setWorkspace({
            workspaceId: s.activeWorkspace.workspaceId,
            workspaceName: s.activeWorkspace.workspaceName
          });
        }
      } catch {
        setSession({ authenticated: false });
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
        setCreating(false);
        setError(null);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setCreating(false);
        setError(null);
      }
    }

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  async function refreshSessionAndUI() {
    // We want the app to be reactive without relying on router.refresh().
    // Keep this as a fallback for any Server Components that may still be cached.
    const shouldUseRouterRefreshFallback = false;

    const s = await fetchAuthSession();
    setSession(s);
    setOptimisticWorkspace(null);
    if (s.authenticated === true && s.activeWorkspace) {
      setWorkspace({
        workspaceId: s.activeWorkspace.workspaceId,
        workspaceName: s.activeWorkspace.workspaceName
      });
    }
    const currentUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : "/";
    startTransition(() => {
      if (shouldUseRouterRefreshFallback) {
        router.refresh();
        // Replacing the same URL helps remount client trees that otherwise keep stale in-memory state.
        router.replace(currentUrl);
      }
    });
  }

  async function switchWorkspace(workspaceId: string) {
    if (!session || session.authenticated !== true) return;
    if (workspaceId === displayedWorkspaceId) {
      setOpen(false);
      setCreating(false);
      setError(null);
      return;
    }

    const target = memberships.find((m) => m.workspaceId === workspaceId) ?? null;
    if (target?.workspaceName) {
      setOptimisticWorkspace({ id: workspaceId, name: target.workspaceName });
      setWorkspace({ workspaceId, workspaceName: target.workspaceName });
    } else {
      setOptimisticWorkspace({ id: workspaceId, name: "Cambiando…" });
      setWorkspace({ workspaceId, workspaceName: "Cambiando…" });
    }
    try {
      window.dispatchEvent(
        new CustomEvent("mis-finanzas:workspace-switch", {
          detail: { status: "start", workspaceId, workspaceName: target?.workspaceName ?? null }
        })
      );
    } catch {
      // noop
    }

    // Keep the dropdown open but lock interactions so the user sees instant feedback.
    setOpen(true);
    setCreating(false);
    setError(null);
    setSwitching(true);
    setSwitchingWorkspaceId(workspaceId);
    const response = await fetch("/api/auth/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId })
    });

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      setError(payload?.message ?? "No se pudo cambiar workspace.");
      setSwitching(false);
      setSwitchingWorkspaceId(null);
      setOptimisticWorkspace(null);
      try {
        window.dispatchEvent(
          new CustomEvent("mis-finanzas:workspace-switch", {
            detail: { status: "error", workspaceId, workspaceName: target?.workspaceName ?? null }
          })
        );
      } catch {
        // noop
      }
      return;
    }

    await refreshSessionAndUI();
    setSwitching(false);
    setSwitchingWorkspaceId(null);
    setOpen(false);
    try {
      window.dispatchEvent(
        new CustomEvent("mis-finanzas:workspace-switch", {
          detail: { status: "success", workspaceId, workspaceName: target?.workspaceName ?? null }
        })
      );
    } catch {
      // noop
    }
  }

  async function createWorkspace() {
    if (!createName.trim()) return;
    setError(null);

    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: createName.trim() })
    });
    const payload = (await response.json().catch(() => null)) as CreateWorkspaceResponse | null;
    if (!response.ok) {
      setError(payload?.message ?? "No se pudo crear el workspace.");
      return;
    }

    setCreateName("");
    setCreating(false);
    await refreshSessionAndUI();
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-2 py-1 text-left shadow-[0_14px_30px_rgba(15,23,42,0.08)] backdrop-blur transition sm:px-2.5 sm:py-1.5",
          "hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        title={displayedWorkspaceName}
        disabled={switching}
      >
        <StatPill tone="neutral" className="px-2.5 py-1 text-[10px]">
          {loading ? "…" : badgeText}
        </StatPill>
        <span className="hidden max-w-[160px] truncate text-sm font-semibold text-slate-900 sm:inline">
          {loading ? "Cargando…" : displayedWorkspaceName}
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-500 sm:block" />
      </button>

      {open ? (
        <SurfaceCard
          variant="soft"
          padding="sm"
          className="absolute right-0 top-[calc(100%+10px)] w-[300px] border border-white/80 bg-white/90 shadow-[0_24px_52px_rgba(15,23,42,0.14)]"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Workspaces
              </p>
              {hasMultiple ? (
                <span className="text-xs text-slate-500">{memberships.length} disponibles</span>
              ) : null}
            </div>

            <div className="grid gap-1">
              {memberships.map((m) => {
                const isActive = m.workspaceId === activeWorkspaceId;
                const isSwitchingThis = switching && m.workspaceId === switchingWorkspaceId;
                return (
                  <button
                    key={m.workspaceId}
                    type="button"
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left transition",
                      isActive
                        ? "border border-violet-200 bg-violet-50/90 text-violet-700 shadow-[0_14px_28px_rgba(124,58,237,0.10)]"
                        : "border border-transparent text-slate-700 hover:bg-slate-50"
                    )}
                    onClick={() => {
                      if (switching) return;
                      switchWorkspace(m.workspaceId);
                    }}
                    disabled={switching}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {m.workspaceName}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        Rol: {m.role}
                      </p>
                    </div>
                    {isSwitchingThis ? (
                      <StatPill
                        tone="neutral"
                        className="px-2 py-1 text-[10px] text-slate-700"
                        icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      >
                        Cambiando…
                      </StatPill>
                    ) : isActive ? (
                      <StatPill tone="premium" className="px-2 py-1 text-[10px]">
                        Activo
                      </StatPill>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="h-px w-full bg-slate-200/70" />

            {creating ? (
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    Nombre del workspace
                  </label>
                  <Input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Ej: Personal, Empresa, Familia"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button className="rounded-full" onClick={createWorkspace} disabled={!createName.trim()}>
                    Crear
                  </Button>
                  <Button
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => {
                      setCreating(false);
                      setCreateName("");
                      setError(null);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={() => {
                  setCreating(true);
                  setError(null);
                }}
              >
                <Plus className="h-4 w-4" strokeWidth={1.9} />
                Crear nuevo workspace
              </button>
            )}

            {error ? (
              <SurfaceCard
                variant="soft"
                padding="sm"
                className="border-rose-200/80 bg-rose-50/80 text-rose-700"
              >
                <p className="text-sm font-medium">{error}</p>
              </SurfaceCard>
            ) : null}
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
