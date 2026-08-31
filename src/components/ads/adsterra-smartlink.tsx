"use client";

import React from "react";
import { ADSTERRA } from "@/lib/adsterra";

/** Smartlink só como texto — NUNCA redirect automático (tráfego inválido). */
export function AdsterraSmartlink({ className }: { className?: string }) {
  return (
    <a
      href={ADSTERRA.smartlink}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={
        className ||
        "text-[10px] text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
      }
    >
      Ofertas parceiras
    </a>
  );
}
