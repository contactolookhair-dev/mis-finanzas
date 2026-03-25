"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { navigationItems } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const visibleNavigationItems = navigationItems.filter((item) =>
    "hidden" in item ? !item.hidden : true
  );

  return (
    <div className="min-h-screen">
      <div className="screen-shell">
        <div className="lg:pl-[120px]">
          <header className="glass-panel sticky top-3 z-20 mb-5 rounded-[24px] px-4 py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.08)] sm:mb-6 sm:px-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-500/80">
                    Mis Finanzas · Manual
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-[1.35rem] font-semibold leading-tight tracking-[-0.03em] text-slate-900 sm:text-[1.45rem]">Tu dinero hoy</h1>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-500">
                      Personal
                    </span>
                  </div>
                </div>
                <div className="hidden items-center gap-3 sm:flex">
                  <Link
                    href="/movimientos"
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-9 border-slate-200 bg-white px-3 text-xs font-semibold")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva transacción
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:hidden">
                <Link
                  href="/movimientos"
                  className={cn(buttonVariants({ variant: "secondary" }), "h-10 border-slate-200 bg-white text-xs font-semibold")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva transacción
                </Link>
              </div>
            </div>
          </header>

          <main className="pb-24 sm:pb-28">
            <PageContainer size="wide">{children}</PageContainer>
          </main>
        </div>

        <nav className="glass-panel fixed inset-x-4 bottom-4 z-30 rounded-[28px] border-white/70 bg-white/86 p-2 shadow-[0_12px_28px_rgba(15,23,42,0.12)] lg:inset-x-auto lg:left-6 lg:top-1/2 lg:h-fit lg:w-[94px] lg:-translate-y-1/2">
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
                      ? "bg-gradient-to-br from-violet-600 via-fuchsia-600 to-emerald-500 text-white shadow-[0_8px_18px_rgba(124,58,237,0.35)]"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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
