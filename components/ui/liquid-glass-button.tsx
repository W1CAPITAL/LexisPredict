"use client";

/**
 * Liquid Glass Button — estilo premium (Cult / glass)
 * Use variant="liquid" no Button ou <LiquidButton>
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface LiquidButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const LiquidButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  ({ className, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "liquid-btn relative inline-flex items-center justify-center gap-2 overflow-hidden",
          "rounded-full px-6 py-2.5 text-sm font-semibold",
          "text-primary-foreground",
          "bg-primary/90 backdrop-blur-md",
          "border border-white/20 shadow-[0_8px_32px_rgba(37,99,235,0.25)]",
          "transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(37,99,235,0.35)]",
          "active:scale-[0.98]",
          "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/25 before:via-transparent before:to-transparent before:opacity-70",
          "after:absolute after:-inset-px after:rounded-full after:bg-gradient-to-r after:from-cyan-400/30 after:via-primary/20 after:to-violet-400/30 after:opacity-0 hover:after:opacity-100 after:transition-opacity after:duration-500 after:-z-10 after:blur-sm",
          "disabled:opacity-50 disabled:pointer-events-none",
          className
        )}
        {...props}
      >
        <span className="relative z-10 flex items-center gap-2">{children}</span>
      </Comp>
    );
  }
);
LiquidButton.displayName = "LiquidButton";
