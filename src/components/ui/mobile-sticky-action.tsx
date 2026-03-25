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
          "h-14 w-full rounded-[22px] bg-primary text-base font-semibold text-white shadow-[0_22px_42px_rgba(37,99,235,0.22)]",
          className
        )}
      >
        {children}
      </Button>
    </div>
  );
}
