import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function PageContainer({
  className,
  size = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  size?: "default" | "wide" | "narrow";
}) {
  const sizeClass =
    size === "wide" ? "max-w-[1380px]" : size === "narrow" ? "max-w-5xl" : "max-w-7xl";

  return (
    <div
      className={cn(
        "mx-auto w-full space-y-5 px-1 pb-24 sm:space-y-6",
        sizeClass,
        className
      )}
      {...props}
    />
  );
}

