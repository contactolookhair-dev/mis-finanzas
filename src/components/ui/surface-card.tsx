import type { HTMLAttributes } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const surfaceVariants = {
  default: "border-white/75 bg-white/88 shadow-[0_14px_38px_rgba(15,23,42,0.07)]",
  soft: "border-slate-200/80 bg-white/72 shadow-[0_10px_28px_rgba(15,23,42,0.06)]",
  highlight:
    "border-violet-100 bg-gradient-to-br from-white via-white to-violet-50/70 shadow-[0_16px_42px_rgba(124,58,237,0.09)]",
  dark: "border-white/10 bg-slate-950/92 text-white shadow-[0_22px_48px_rgba(15,23,42,0.22)]"
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
    padding === "sm" ? "p-4" : padding === "lg" ? "p-6 sm:p-7" : "p-5 sm:p-6";

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

