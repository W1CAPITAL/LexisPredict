"use client";

/**
 * Botão metal líquido (CSS animado) — sem WebGL para nunca desaparecer.
 * preset: chromatic | silver | gold
 * mode: liquid | glass-liquid | solid
 */
import * as React from "react";
import type { MetalFxPreset } from "metal-fx";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMetalPreferences } from "@/lib/metal-preferences";

export type LiquidMetalButtonProps = ButtonProps & {
  preset?: MetalFxPreset;
  mode?: "liquid" | "glass-liquid" | "solid";
  strength?: number;
  /** Mantido por compatibilidade de API (já é sempre CSS-only) */
  cssOnly?: boolean;
};

export const LiquidMetalButton = React.forwardRef<
  HTMLButtonElement,
  LiquidMetalButtonProps
>(
  (
    {
      className,
      preset = "chromatic",
      mode = "liquid",
      strength = 1,
      cssOnly = false,
      children,
      ...props
    },
    ref
  ) => {
    const { enabled } = useMetalPreferences();
    const liquidCls = !enabled
      ? ""
      : mode === "glass-liquid"
        ? "glass-liquid-btn"
        : mode === "solid"
          ? preset === "gold"
            ? "metal-btn-solid metal-btn-solid--gold"
            : preset === "silver"
              ? "metal-btn-solid metal-btn-solid--silver"
              : "metal-btn-solid metal-btn-solid--chromatic"
          : cn(
              "liquid-metal",
              preset === "gold" && "liquid-metal--gold",
              preset === "silver" && "liquid-metal--silver"
            );

    return (
      <Button
        ref={ref}
        metal={false}
        className={cn(
          "relative rounded-full border-0",
          liquidCls,
          className
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }
);
LiquidMetalButton.displayName = "LiquidMetalButton";
