import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-border/70 bg-card/92 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.07)] backdrop-blur-xl",
        className
      )}
      {...props}
    />
  );
}
