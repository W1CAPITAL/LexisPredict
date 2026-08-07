"use client";

/**
 * Botão metal líquido (CSS animado) + opcional metal-fx WebGL.
 * preset: chromatic | silver | gold
 * mode: liquid | glass-liquid | solid
 */
import * as React from "react";
import { MetalFx, type MetalFxPreset } from "metal-fx";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LiquidMetalButtonProps = ButtonProps & {
  preset?: MetalFxPreset;
  mode?: "liquid" | "glass-liquid" | "solid";
  strength?: number;
  /** Desliga WebGL e usa só CSS líquido */
  cssOnly?: boolean;
};

function useReducedMotion() {
  const [r, setR] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const s = () => setR(mq.matches);
    s();
    mq.addEventListener("change", s);
    return () => mq.removeEventListener("change", s);
  }, []);
  return r;
}

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
    const reduced = useReducedMotion();
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    const liquidCls =
      mode === "glass-liquid"
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

    const btn = (
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

    if (!mounted || cssOnly || reduced || mode === "glass-liquid") {
      return btn;
    }

    return (
      <MetalFx
        preset={preset}
        variant="button"
        strength={strength}
        theme="dark"
        normalizeHostStyles
        disableGlow
        className="metal-fx-host inline-flex items-center justify-center min-h-[2.25rem] opacity-100"
      >
        {btn}
      </MetalFx>
    );
  }
);
LiquidMetalButton.displayName = "LiquidMetalButton";
