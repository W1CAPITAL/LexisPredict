"use client";

/**
 * Shared W1 Lexis AI activity indicator.
 * Uses MIT-licensed upstream thinking-orbs by Jakub Antalik,
 * vendored under src/vendor/thinking-orbs/ with the original license.
 */
import React from "react";
import { ThinkingOrb, type OrbState, type OrbSize } from "@/vendor/thinking-orbs";

export function LexisThinkingOrb({
  state = "working",
  size = 20,
  "aria-label": label,
}: {
  state?: OrbState;
  size?: OrbSize;
  "aria-label"?: string;
}) {
  return <ThinkingOrb state={state} size={size} theme="auto" aria-label={label} className="shrink-0" />;
}
