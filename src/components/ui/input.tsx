import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        // iOS Safari zooms inputs below 16px font-size. Keep 16px on mobile, preserve compact desktop type.
        "h-11 w-full rounded-2xl border border-border bg-white/90 px-4 text-[16px] outline-none transition placeholder:text-neutral-400 focus:border-primary sm:text-sm",
        props.className
      )}
    />
  );
}
