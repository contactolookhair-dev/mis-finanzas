import type { HTMLAttributes } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const surfaceVariants = {
  default: "border-border/80 bg-white/92 shadow-[0_14px_38px_rgba(15,23,42,0.07)]",
  soft: "border-border/80 bg-white/88 shadow-[0_10px_28px_rgba(15,23,42,0.05)]",
  highlight: "border-border/80 bg-white/96 shadow-[0_16px_42px_rgba(15,23,42,0.08)]",
  brand: "border-border/80 bg-white/96 shadow-[0_16px_42px_rgba(15,23,42,0.08)]",
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
