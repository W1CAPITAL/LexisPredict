"use client";

/**
 * shadcn Button + MetalFx opcional (metal-fx).
 * - metal="auto" (padrão): anel metálico em default | liquid | destructive (não em icon/ghost/link)
 * - metal={true|false}: força liga/desliga
 * - preset: chromatic | silver | gold
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { MetalFx, type MetalFxPreset } from "metal-fx";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        liquid:
          "liquid-btn relative overflow-hidden rounded-full bg-primary/90 text-primary-foreground border border-white/20 shadow-[0_8px_28px_rgba(37,99,235,0.22)] backdrop-blur-md hover:scale-[1.02] hover:shadow-[0_12px_36px_rgba(37,99,235,0.32)] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/20 before:to-transparent",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** auto | true | false — ver cabeçalho do arquivo */
  metal?: boolean | "auto";
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

function shouldMetal(
  metal: boolean | "auto" | undefined,
  variant: ButtonProps["variant"],
  size: ButtonProps["size"]
) {
  if (metal === true) return true;
  if (metal === false) return false;
  // auto
  if (size === "icon") return false;
  if (variant === "ghost" || variant === "link" || variant === "outline") return false;
  return (
    variant === "default" ||
    variant === "liquid" ||
    variant === "destructive" ||
    variant == null
  );
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      metal = "auto",
      metalPreset = "chromatic",
      metalStrength = 0.88,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const reduced = useReducedMotion();
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    const cls = cn(buttonVariants({ variant, size, className }));
    const enableMetal =
      mounted && !reduced && !asChild && shouldMetal(metal, variant, size);

    const node = (
      <Comp className={cls} ref={ref} {...props} />
    );

    if (!enableMetal) return node;

    return (
      <MetalFx
        preset={metalPreset}
        variant={size === "icon" ? "circle" : "button"}
        strength={metalStrength}
        theme="auto"
        normalizeHostStyles
        className="inline-flex"
      >
        {node}
      </MetalFx>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
