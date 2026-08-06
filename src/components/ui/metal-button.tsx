"use client";

/**
 * MetalButton — metal-fx (WebGL) + fallback CSS se o shader falhar/SSR.
 * Presets: chromatic | silver | gold
 */
import * as React from "react";
import { MetalFx, type MetalFxPreset, type MetalFxVariant } from "metal-fx";
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

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

export const MetalButton = React.forwardRef<HTMLButtonElement, MetalButtonProps>(
  (
    {
      className,
      preset = "chromatic",
      metalVariant = "button",
      strength = 0.9,
      paused = false,
      disableGlow = false,
      theme = "auto",
      metalFxClassName,
      children,
      ...props
    },
    ref
  ) => {
    const reduced = useReducedMotion();
    const effectivePaused = paused || reduced;
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    const btn = (
      <Button
        ref={ref}
        className={cn("relative z-[1] rounded-full", className)}
        {...props}
      >
        {children}
      </Button>
    );

    if (!mounted) {
      return btn;
    }

    return (
      <MetalFx
        preset={preset}
        variant={metalVariant}
        strength={strength}
        paused={effectivePaused}
        disableGlow={disableGlow}
        theme={theme}
        className={cn("inline-flex", metalFxClassName)}
        normalizeHostStyles
      >
        {btn}
      </MetalFx>
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
