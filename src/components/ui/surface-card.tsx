import type { HTMLAttributes } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const surfaceVariants = {
  default: "border-border/80 bg-white/92",
  soft: "border-border/80 bg-white/88",
  highlight: "border-border/80 bg-white/96",
  brand: "border-border/80 bg-white/96",
  // Keep a slightly stronger shadow for dark surfaces.
  dark: "border-white/10 bg-slate-950/94 text-white shadow-[0_12px_40px_rgba(0,0,0,0.22)]"
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
    padding === "sm" ? "p-5 sm:p-6" : padding === "lg" ? "p-7 sm:p-8 lg:p-9" : "p-6 sm:p-7 lg:p-8";

  return (
    <Card
      className={cn(
        "rounded-[32px] backdrop-blur-sm",
        paddingClass,
        surfaceVariants[variant],
        className
      )}
      {...props}
    />
  );
}
