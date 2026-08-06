/**
 * Política metal — força alta nos CTAs (pedido: metal bem visível).
 */
import type { MetalFxPreset } from "metal-fx";

export type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link"
  | "liquid"
  | null
  | undefined;

export type ButtonSize = "default" | "sm" | "lg" | "icon" | null | undefined;
export type MetalMode = boolean | "auto";

const METAL_VARIANTS = new Set<string>([
  "default",
  "liquid",
  "destructive",
  "secondary",
]);

const NEVER_AUTO = new Set<string>(["ghost", "link"]);

export function resolveMetalEnabled(opts: {
  metal?: MetalMode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  reducedMotion?: boolean;
  mounted?: boolean;
}): boolean {
  const {
    metal = "auto",
    variant,
    size,
    asChild,
    reducedMotion,
    mounted = true,
  } = opts;

  if (!mounted || reducedMotion || asChild) return false;
  if (metal === true) return true;
  if (metal === false) return false;

  // auto: inclui secondary e outline com fundo; icon também pode ser metal
  const v = variant ?? "default";
  if (NEVER_AUTO.has(v)) return false;
  if (METAL_VARIANTS.has(v) || v === "outline") return true;
  if (size === "icon" && (v === "default" || v === "secondary")) return true;
  return false;
}

export function resolveMetalPreset(
  preset?: MetalFxPreset,
  variant?: ButtonVariant
): MetalFxPreset {
  if (preset) return preset;
  if (variant === "destructive") return "gold";
  if (variant === "secondary") return "silver";
  if (variant === "liquid") return "chromatic";
  return "chromatic";
}

/** Força máxima padrão — efeito bem perceptível */
export function resolveMetalStrength(
  strength?: number,
  size?: ButtonSize
): number {
  if (typeof strength === "number" && strength >= 0 && strength <= 1) {
    return strength;
  }
  if (size === "sm") return 0.95;
  if (size === "lg") return 1;
  return 1; // default full strength
}

export function metalSurfaceClass(preset: MetalFxPreset = "chromatic"): string {
  return `metal-surface metal-surface--${preset}`;
}
