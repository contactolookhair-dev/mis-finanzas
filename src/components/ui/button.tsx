"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "tap-feedback inline-flex items-center justify-center rounded-full text-sm font-medium tracking-[-0.01em]",
    // Global premium motion.
    "transition-all duration-200 ease-out will-change-[transform,box-shadow]",
    // Tactile scaling.
    "hover:scale-[1.02] active:scale-[0.98]",
    "disabled:hover:scale-100 disabled:active:scale-100",
    // Focus + disabled.
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-white shadow-[0_10px_28px_rgba(37,99,235,0.16)] hover:brightness-[1.01] hover:shadow-[0_12px_34px_rgba(37,99,235,0.18)]",
        secondary:
          "border border-border/80 bg-white/84 text-foreground shadow-[0_8px_30px_rgba(0,0,0,0.05)] hover:border-primary/20 hover:bg-white hover:shadow-[0_12px_40px_rgba(0,0,0,0.07)]",
        ghost: "text-foreground hover:bg-muted/70"
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3 text-xs",
        icon: "h-11 w-11"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
