"use client";

/**
 * MetalButton — strength 1.0 + fundo metálico reforçado.
 */
import * as React from "react";
import { MetalFx, type MetalFxPreset } from "metal-fx";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

export type MetalButtonProps = ButtonProps & {
  preset?: MetalFxPreset;
  strength?: number;
  metalVariant?: "button" | "circle";
  paused?: boolean;
};

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
      preset = "chromatic",
      strength = 1,
      metalVariant,
      paused = false,
      className,
      size,
      variant = "default",
      asChild,
      ...props
    },
    ref
  ) => {
    const reduced = useReducedMotion();
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    const shape = metalVariant || (size === "icon" ? "circle" : "button");

    // Fundo metálico CSS por baixo do WebGL (mais “peso” visual)
    const metalBg =
      preset === "gold"
        ? "bg-gradient-to-br from-amber-200 via-amber-400 to-amber-700 text-black border-amber-500/40"
        : preset === "silver"
          ? "bg-gradient-to-br from-slate-100 via-slate-300 to-slate-500 text-slate-900 border-slate-400/50"
          : "bg-gradient-to-br from-sky-300 via-violet-400 to-pink-400 text-slate-950 border-white/30";

    const btn = (
      <Button
        ref={ref}
        size={size}
        variant={variant}
        asChild={asChild}
        metal={false}
        className={cn(
          "shadow-[0_10px_28px_rgba(0,0,0,0.22)] hover:shadow-[0_14px_36px_rgba(0,0,0,0.28)]",
          "border font-black",
          metalBg,
          className
        )}
        {...props}
      />
    );

    if (!mounted || reduced || paused || asChild) {
      return btn;
    }

    return (
      <MetalFx
        preset={preset}
        variant={shape}
        strength={Math.min(1, Math.max(0.85, strength))}
        theme="auto"
        normalizeHostStyles
        className="inline-flex"
      >
        {btn}
      </MetalFx>
    );
  }
);
MetalButton.displayName = "MetalButton";

export function MetalIconButton(props: MetalButtonProps) {
  return <MetalButton size="icon" metalVariant="circle" {...props} />;
}
