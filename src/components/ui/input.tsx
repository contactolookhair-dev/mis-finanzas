import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-11 w-full rounded-2xl border border-border bg-white/90 px-4 text-sm outline-none transition placeholder:text-neutral-400 focus:border-primary",
        props.className
      )}
    />
  );
}
