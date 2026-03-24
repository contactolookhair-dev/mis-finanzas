import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-white/70 bg-card/90 p-5 shadow-card backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}
