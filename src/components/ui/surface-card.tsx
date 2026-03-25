import type { HTMLAttributes } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const surfaceVariants = {
  default: "border-white/78 bg-white/92 shadow-[0_14px_38px_rgba(15,23,42,0.07)]",
  soft: "border-border/80 bg-white/76 shadow-[0_10px_28px_rgba(15,23,42,0.05)]",
  highlight:
    "border-primary/12 bg-gradient-to-br from-white via-white to-primary/5 shadow-[0_16px_42px_rgba(95,99,242,0.08)]",
  brand:
    "border-primary/12 bg-gradient-to-br from-white via-white to-secondary/5 shadow-[0_16px_42px_rgba(214,91,142,0.08)]",
  dark: "border-white/10 bg-slate-950/94 text-white shadow-[0_22px_48px_rgba(15,23,42,0.22)]"
} as const;

export function SurfaceCard({
  className,
  variant = "default",
  padding = "md",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: keyof typeof surfaceVariants;
  padding?: "sm" | "md" | "lg";
}) {
  const paddingClass =
    padding === "sm" ? "p-4 sm:p-5" : padding === "lg" ? "p-6 sm:p-7 lg:p-8" : "p-5 sm:p-6 lg:p-7";

  return (
    <Card
      className={cn(
        "rounded-[28px] backdrop-blur-sm",
        paddingClass,
        surfaceVariants[variant],
        className
      )}
      {...props}
    />
  );
}
