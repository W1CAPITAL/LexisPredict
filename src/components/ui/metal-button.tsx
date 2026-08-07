"use client";

/**
 * MetalButton — contraste alto em tema claro, 100% CSS (sem WebGL).
 * Fundo sólido SEMPRE: não depende de shader, então nunca fica invisível.
 */
import * as React from "react";
import type { MetalFxPreset, MetalFxVariant } from "metal-fx";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type { MetalFxPreset };

type MetalShared = {
  preset?: MetalFxPreset;
  metalVariant?: MetalFxVariant;
  strength?: number;
  paused?: boolean;
  disableGlow?: boolean;
  theme?: "dark" | "light" | "auto";
  metalFxClassName?: string;
};

export type MetalButtonProps = ButtonProps & MetalShared;

export const MetalButton = React.forwardRef<HTMLButtonElement, MetalButtonProps>(
  (
    {
      className,
      preset = "chromatic",
      metalVariant = "button",
      strength = 1,
      paused = false,
      disableGlow = false,
      theme = "auto",
      metalFxClassName,
      children,
      variant = "default",
      ...props
    },
    ref
  ) => {
    const solidPreset =
      preset === "gold"
        ? "metal-btn-solid metal-btn-solid--gold"
        : preset === "silver"
          ? "metal-btn-solid metal-btn-solid--silver"
          : "metal-btn-solid metal-btn-solid--chromatic";

    return (
      <Button
        ref={ref}
        variant={variant}
        metal={false}
        className={cn(
          "relative z-[1] rounded-full",
          solidPreset,
          className
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }
);
MetalButton.displayName = "MetalButton";

export type MetalIconButtonProps = Omit<MetalButtonProps, "size"> & {
  "aria-label": string;
};

export const MetalIconButton = React.forwardRef<
  HTMLButtonElement,
  MetalIconButtonProps
>(({ metalVariant = "circle", className, ...props }, ref) => (
  <MetalButton
    ref={ref}
    size="icon"
    metalVariant={metalVariant}
    className={cn("h-10 w-10", className)}
    {...props}
  />
));
MetalIconButton.displayName = "MetalIconButton";
