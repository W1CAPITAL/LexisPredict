"use client";

import React, { useEffect, useState } from "react";
import { loadUiPreferences } from "@/lib/ui-preferences";

/**
 * Camada de partículas opcional (leve). Só renderiza se prefs.particles = true.
 * Não afeta lógica de negócio.
 */
export function ParticlesLayer() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const apply = () => setOn(!!loadUiPreferences().particles);
    apply();
    window.addEventListener("lexis-ui-prefs", apply);
    return () => window.removeEventListener("lexis-ui-prefs", apply);
  }, []);

  if (!on) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-40"
    >
      {Array.from({ length: 24 }).map((_, i) => (
        <span
          key={i}
          className="absolute block h-1 w-1 rounded-full bg-primary/60 animate-pulse"
          style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 53) % 100}%`,
            animationDelay: `${(i % 8) * 0.2}s`,
            opacity: 0.15 + (i % 5) * 0.08,
          }}
        />
      ))}
    </div>
  );
}
