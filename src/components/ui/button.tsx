"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "tap-feedback inline-flex items-center justify-center rounded-full text-sm font-medium tracking-[-0.01em] transition-[transform,box-shadow,background-color,border-color,color,opacity,filter] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.985]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-primary via-primary to-secondary text-white shadow-[0_12px_26px_rgba(95,99,242,0.22)] hover:brightness-[1.01] hover:shadow-[0_14px_30px_rgba(95,99,242,0.24)]",
        secondary:
          "border border-border/80 bg-white/84 text-foreground shadow-[0_8px_20px_rgba(15,23,42,0.05)] hover:border-primary/20 hover:bg-white",
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
