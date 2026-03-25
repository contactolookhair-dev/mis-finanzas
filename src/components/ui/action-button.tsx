"use client";

import type { ComponentType, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActionTone = "neutral" | "danger" | "premium" | "ghost";

const toneClasses: Record<ActionTone, string> = {
  neutral: "border border-border/80 bg-white/84 text-foreground shadow-[0_8px_20px_rgba(15,23,42,0.05)] hover:border-primary/20 hover:bg-white",
  danger: "border border-rose-200/80 bg-rose-50/88 text-rose-700 shadow-[0_8px_20px_rgba(220,91,103,0.06)] hover:border-rose-300 hover:bg-rose-50",
  premium:
    "border border-primary/14 bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 text-primary shadow-[0_8px_20px_rgba(95,99,242,0.08)] hover:border-primary/20",
  ghost: "border-transparent bg-transparent text-slate-600 hover:bg-muted/70 hover:text-slate-900"
};

export function ActionButton({
  icon: Icon,
  children,
  tone = "neutral",
  loading = false,
  className,
  disabled,
  ...props
}: ButtonProps & {
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  tone?: ActionTone;
  loading?: boolean;
}) {
  const isDisabled = loading || disabled;

  return (
    <Button
      variant="ghost"
      className={cn(
        "tap-feedback inline-flex h-9 rounded-full px-3 text-xs font-semibold leading-none tracking-[0.01em] transition-all duration-200 active:scale-[0.985]",
        toneClasses[tone],
        className
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" /> : Icon ? <Icon className="mr-2 h-4 w-4 shrink-0" /> : null}
      <span className="truncate">{children}</span>
    </Button>
  );
}
