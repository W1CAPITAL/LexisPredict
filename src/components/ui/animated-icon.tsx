"use client";

/**
 * Ícones com microanimações (estilo Grok): glow, float, pulse, shimmer.
 * Uso: <AnimatedIcon icon={Bot} variant="glow" />
 */

import React from "react";
import { cn } from "@/lib/utils";
import type { LucideProps } from "lucide-react";

export type IconAnimVariant =
  | "none"
  | "float"
  | "pulse"
  | "glow"
  | "spin-slow"
  | "bounce"
  | "shimmer"
  | "wiggle";

type LucideIcon = React.ComponentType<LucideProps>;

export function AnimatedIcon({
  icon: Icon,
  variant = "glow",
  size = 18,
  className,
  strokeWidth = 2,
  active = true,
}: {
  icon: LucideIcon;
  variant?: IconAnimVariant;
  size?: number;
  className?: string;
  strokeWidth?: number;
  /** se false, renderiza estático */
  active?: boolean;
}) {
  const anim =
    !active || variant === "none"
      ? ""
      : variant === "float"
        ? "lex-anim-float"
        : variant === "pulse"
          ? "lex-anim-pulse"
          : variant === "glow"
            ? "lex-anim-glow"
            : variant === "spin-slow"
              ? "lex-anim-spin-slow"
              : variant === "bounce"
                ? "lex-anim-bounce"
                : variant === "shimmer"
                  ? "lex-anim-shimmer"
                  : variant === "wiggle"
                    ? "lex-anim-wiggle"
                    : "";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center relative shrink-0",
        anim,
        className
      )}
      style={{ width: size, height: size }}
    >
      <Icon size={size} strokeWidth={strokeWidth} className="relative z-[1]" />
    </span>
  );
}

/** Mapa sugerido por rota/contexto */
export const NAV_ICON_VARIANT: Record<string, IconAnimVariant> = {
  "/": "glow",
  "/tarefas": "pulse",
  "/cases": "float",
  "/veredito": "shimmer",
  "/whatsapp": "bounce",
  "/chatbot-separado": "glow",
  "/settings": "none",
  scanner: "spin-slow",
};
