"use client";

/**
 * MetalButton — contraste alto em tema claro + WebGL.
 * Fundo sólido SEMPRE (não depende só do shader).
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

function useIsDark() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

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
    const reduced = useReducedMotion();
    const isDark = useIsDark();
    const effectivePaused = paused || reduced;
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    // Em tema claro, force shader "dark" para o metal aparecer no fundo branco
    const fxTheme =
      theme === "auto" ? (isDark ? "dark" : "dark") : theme;

    const solidPreset =
      preset === "gold"
        ? "metal-btn-solid metal-btn-solid--gold"
        : preset === "silver"
          ? "metal-btn-solid metal-btn-solid--silver"
          : "metal-btn-solid metal-btn-solid--chromatic";

    const btn = (
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

    if (!mounted) {
      return btn;
    }

    return (
      <MetalFx
        preset={preset}
        variant={metalVariant}
        strength={Math.min(1, Math.max(0.9, strength))}
        paused={effectivePaused}
        disableGlow={disableGlow}
        theme={fxTheme}
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
