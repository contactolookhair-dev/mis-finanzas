import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "border-slate-200 bg-white/80 text-slate-600",
  success: "border-emerald-200 bg-emerald-50/90 text-emerald-700",
  warning: "border-amber-200 bg-amber-50/90 text-amber-700",
  danger: "border-rose-200 bg-rose-50/90 text-rose-700",
  premium: "border-violet-200 bg-violet-50/90 text-violet-700"
} as const;

export function StatPill({
  children,
  tone = "neutral",
  icon,
  className
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.02em]",
        tones[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

