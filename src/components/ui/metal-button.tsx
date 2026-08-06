"use client";

/**
 * MetalButton / MetalIconButton — efeito metálico em CSS (sem WebGL / metal-fx).
 * Compatível com shadcn Button. Respeita prefers-reduced-motion.
 */
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MetalFxPreset = "chromatic" | "silver" | "gold";

const PRESET_RING: Record<MetalFxPreset, string> = {
  chromatic:
    "bg-[conic-gradient(from_var(--metal-angle),#60a5fa,#a78bfa,#f472b6,#fbbf24,#34d399,#60a5fa)]",
  silver:
    "bg-[conic-gradient(from_var(--metal-angle),#e5e7eb,#9ca3af,#f9fafb,#6b7280,#e5e7eb)]",
  gold:
    "bg-[conic-gradient(from_var(--metal-angle),#fde68a,#d97706,#fef3c7,#b45309,#fde68a)]",
};

type MetalShared = {
  preset?: MetalFxPreset;
  metalVariant?: "button" | "circle";
  strength?: number;
  paused?: boolean;
  disableGlow?: boolean;
  metalFxClassName?: string;
  theme?: "light" | "dark";
  reflectionTargets?: React.RefObject<HTMLElement | null>[];
};

export type MetalButtonProps = ButtonProps & MetalShared;

export const MetalButton = React.forwardRef<HTMLButtonElement, MetalButtonProps>(
  (
    {
      className,
      preset = "chromatic",
      metalVariant = "button",
      strength = 0.85,
      paused = false,
      disableGlow = false,
      metalFxClassName,
      theme,
      reflectionTargets: _reflectionTargets,
      children,
      ...props
    },
    ref
  ) => {
    const ringPad = metalVariant === "circle" ? "p-[3px]" : "p-[2px]";
    return (
      <span
        className={cn(
          "metal-fx-wrap relative inline-flex rounded-full",
          ringPad,
          !disableGlow && "metal-fx-glow",
          paused && "metal-fx-paused",
          metalFxClassName
        )}
        style={
          {
            "--metal-strength": String(strength),
            "--metal-angle": "0deg",
          } as React.CSSProperties
        }
        data-theme={theme}
      >
        <span
          aria-hidden
          className={cn(
            "metal-fx-ring absolute inset-0 rounded-full opacity-[var(--metal-strength,0.85)]",
            PRESET_RING[preset]
          )}
        />
        <Button
          ref={ref}
          className={cn(
            "relative z-[1] rounded-full border-0 shadow-none",
            metalVariant === "circle" && "rounded-full",
            className
          )}
          {...props}
        >
          {children}
        </Button>
      </span>
    );
  }
);
MetalButton.displayName = "MetalButton";

export type MetalIconButtonProps = Omit<MetalButtonProps, "size"> & {
  "aria-label": string;
};

export const MetalIconButton = React.forwardRef<HTMLButtonElement, MetalIconButtonProps>(
  ({ metalVariant = "circle", className, ...props }, ref) => (
    <MetalButton
      ref={ref}
      size="icon"
      metalVariant={metalVariant}
      className={cn("h-10 w-10", className)}
      {...props}
    />
  )
);
MetalIconButton.displayName = "MetalIconButton";
