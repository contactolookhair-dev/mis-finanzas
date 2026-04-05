"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, LogOut, Settings2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { fetchAuthSession } from "@/shared/lib/auth-session-client";

function buildInitials(input?: string | null) {
  const value = String(input ?? "").trim();
  if (!value) return "?";
  const parts = value.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${second}`.toUpperCase();
}

export function UserMenu({ className }: { className?: string }) {
  const { data } = useSession();
  const user = data?.user;
  const label = user?.name ?? user?.email ?? "Mi cuenta";
  const email = user?.email ?? null;
  const image = user?.image ?? null;

  const initials = useMemo(() => buildInitials(label), [label]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [canViewSettings, setCanViewSettings] = useState(false);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadPermissions() {
      try {
        const s = await fetchAuthSession();
        if (!alive) return;
        setCanViewSettings(Boolean(s.authenticated === true ? s.permissions?.canViewSettings : false));
      } catch {
        if (!alive) return;
        setCanViewSettings(false);
      }
    }
    void loadPermissions();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "group flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-2 py-1.5 text-left shadow-[0_14px_30px_rgba(15,23,42,0.08)] backdrop-blur transition",
          "hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-slate-900/90 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(15,23,42,0.16)]">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </span>
        <span className="hidden max-w-[180px] flex-col leading-tight sm:flex">
          <span className="truncate text-sm font-semibold text-slate-900">{label}</span>
          {email ? <span className="truncate text-xs text-slate-500">{email}</span> : null}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-500 transition group-hover:text-slate-700" />
      </button>

      {open ? (
        <SurfaceCard
          variant="soft"
          padding="sm"
          className={cn(
            "absolute right-0 top-[calc(100%+10px)] w-[270px] border border-white/80 bg-white/90 shadow-[0_24px_52px_rgba(15,23,42,0.14)]"
          )}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-slate-900/90 text-sm font-semibold text-white">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
                {email ? <p className="truncate text-xs text-slate-500">{email}</p> : null}
              </div>
            </div>

            <div className="h-px w-full bg-slate-200/70" />

            <div className="grid gap-1">
              <Link
                href="/perfil"
                className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                <User className="h-4 w-4" strokeWidth={1.9} />
                Perfil
              </Link>
              {canViewSettings ? (
                <Link
                  href="/configuracion"
                  className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  <Settings2 className="h-4 w-4" strokeWidth={1.9} />
                  Configuración
                </Link>
              ) : null}
            </div>

            <Button
              variant="secondary"
              className="w-full justify-start rounded-2xl"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" strokeWidth={1.9} />
              Cerrar sesión
            </Button>
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
