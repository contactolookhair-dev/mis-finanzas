"use client";

import { useEffect, useState } from "react";
import { Calculator, Plus, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Props = {
  onOpenCalculator: () => void;
  onOpenTransaction: () => void;
};

export function MobileHomeStack({ onOpenCalculator, onOpenTransaction }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={cn(
        "fixed right-3 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-2 sm:hidden",
        scrolled ? "opacity-90" : "opacity-100"
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (pathname === "/inicio") {
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
          }
          router.push("/inicio");
        }}
        className={cn(
          "glass-surface tap-feedback pointer-events-auto inline-flex items-center gap-2 rounded-[18px] px-3 py-2 text-[11px] font-semibold tracking-[-0.01em] text-slate-900 shadow-[0_12px_28px_rgba(15,23,42,0.1)]",
          scrolled && "scale-[0.98]"
        )}
        aria-label="Ir a Mis Finanzas"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-2xl bg-white/80 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <span>Mis Finanzas</span>
      </button>

      <button
        type="button"
        onClick={onOpenTransaction}
        className={cn(
          "glass-surface tap-feedback pointer-events-auto inline-flex items-center gap-2 rounded-[18px] px-3 py-2 text-[11px] font-semibold tracking-[-0.01em] text-slate-900 shadow-[0_12px_28px_rgba(15,23,42,0.1)]",
          scrolled && "scale-[0.98]"
        )}
        aria-label="Nueva transacción"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-2xl bg-white/80 text-emerald-600">
          <Plus className="h-4 w-4" />
        </span>
        <span>Nueva</span>
      </button>

      <button
        type="button"
        onClick={onOpenCalculator}
        className={cn(
          "glass-surface tap-feedback pointer-events-auto inline-flex items-center gap-2 rounded-[18px] px-3 py-2 text-[11px] font-semibold tracking-[-0.01em] text-slate-900 shadow-[0_12px_28px_rgba(15,23,42,0.1)]",
          scrolled && "scale-[0.98]"
        )}
        aria-label="Abrir calculadora"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-2xl bg-white/80 text-sky-600">
          <Calculator className="h-4 w-4" />
        </span>
        <span>Calculadora</span>
      </button>
    </div>
  );
}
