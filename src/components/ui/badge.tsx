import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const toneClasses = {
  neutral:
    "border-border/80 bg-white/86 text-foreground shadow-[0_6px_14px_rgba(15,23,42,0.03)]",
  success:
    "border-emerald-200/80 bg-emerald-50/92 text-emerald-700 shadow-[0_6px_14px_rgba(15,155,111,0.06)]",
  warning:
    "border-amber-200/80 bg-amber-50/92 text-amber-700 shadow-[0_6px_14px_rgba(194,132,24,0.06)]",
  danger:
    "border-rose-200/80 bg-rose-50/92 text-rose-700 shadow-[0_6px_14px_rgba(220,91,103,0.06)]",
  brand:
    "border-primary/18 bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 text-primary shadow-[0_6px_14px_rgba(95,99,242,0.08)]"
};

export function Badge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: keyof typeof toneClasses;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.03em] backdrop-blur-sm",
        toneClasses[tone]
      )}
    >
      {children}
    </span>
  );
}
