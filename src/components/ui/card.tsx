import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        [
          // Premium baseline surface.
          "rounded-[32px] border border-border/70 bg-card/92 backdrop-blur-xl",
          // Spacing: more breathing room by default.
          "p-6",
          // Premium shadows: softer and more modern.
          "shadow-[0_8px_30px_rgba(0,0,0,0.06)]",
          // Motion.
          "motion-safe:animate-[fadeIn_0.4s_ease-out]",
          "transition-all duration-300 ease-out will-change-[transform,box-shadow]",
          // Lift + hover shadow (only meaningful on hover devices).
          "hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
        ].join(" "),
        className
      )}
      {...props}
    />
  );
}
