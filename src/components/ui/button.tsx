"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { MetalFxPreset } from "metal-fx";
import { cn } from "@/lib/utils";
import {
  resolveMetalEnabled,
  resolveMetalPreset,
  type MetalMode,
} from "@/lib/metal-policy";
import { useMetalPreferences } from "@/lib/metal-preferences";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        liquid:
          "liquid-btn relative overflow-hidden rounded-full bg-primary/90 text-primary-foreground border border-white/20",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  metal?: MetalMode;
  metalPreset?: MetalFxPreset;
  metalStrength?: number;
}

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

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      metal = "auto",
      metalPreset,
      metalStrength,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const reduced = useReducedMotion();
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);
    const metalPrefs = useMetalPreferences();

    const enableMetal =
      metalPrefs.enabled &&
      resolveMetalEnabled({
        metal,
        variant,
        size,
        asChild,
        reducedMotion: reduced,
        mounted,
      });
    const preset = resolveMetalPreset(metalPreset, variant);

    const solid =
      enableMetal
        ? preset === "gold"
          ? "metal-btn-solid metal-btn-solid--gold"
          : preset === "silver"
            ? "metal-btn-solid metal-btn-solid--silver"
            : "metal-btn-solid metal-btn-solid--chromatic"
        : "";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), solid)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
