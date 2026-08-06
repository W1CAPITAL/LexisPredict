/**
 * Política única de metal automático (shadcn Button).
 * Centraliza regras — UI e tokens não duplicam lógica.
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

/** Variantes que merecem anel WebGL por padrão */
const METAL_VARIANTS = new Set<string>(["default", "liquid", "destructive"]);

/** Nunca metal automático (densidade de UI / performance) */
const NEVER_AUTO = new Set<string>(["ghost", "link", "outline"]);

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

  // auto
  if (size === "icon") return false;
  const v = variant ?? "default";
  if (NEVER_AUTO.has(v)) return false;
  if (METAL_VARIANTS.has(v)) return true;
  // secondary: CSS token only (no WebGL) — treat as false here
  return false;
}

export function resolveMetalPreset(
  preset?: MetalFxPreset,
  variant?: ButtonVariant
): MetalFxPreset {
  if (preset) return preset;
  if (variant === "destructive") return "gold";
  if (variant === "liquid") return "chromatic";
  return "chromatic";
}

export function resolveMetalStrength(
  strength?: number,
  size?: ButtonSize
): number {
  if (typeof strength === "number" && strength >= 0 && strength <= 1) {
    return strength;
  }
  if (size === "sm") return 0.72;
  if (size === "lg") return 0.95;
  return 0.88;
}

export function metalSurfaceClass(preset: MetalFxPreset = "chromatic"): string {
  return `metal-surface metal-surface--${preset}`;
}
