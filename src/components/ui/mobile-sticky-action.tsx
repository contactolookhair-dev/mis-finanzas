import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileStickyAction({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & {
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-x-4 bottom-24 z-30 sm:hidden">
      <Button
        {...props}
        className={cn(
          "h-14 w-full rounded-[22px] bg-gradient-to-r from-violet-600 via-fuchsia-600 to-emerald-500 text-base font-semibold text-white shadow-[0_22px_42px_rgba(124,58,237,0.28)]",
          className
        )}
      >
        {children}
      </Button>
    </div>
  );
}

