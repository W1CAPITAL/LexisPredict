"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ADSTERRA, AD_PATH_BLOCK } from "@/lib/adsterra";

const DISMISS = "lexis_ad_native_until";
const LOADED = "lexis_ad_native_loaded";

/** Native Banner — rodapé do conteúdo, 1x por sessão. */
export function AdsterraNative() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (AD_PATH_BLOCK.some((p) => window.location.pathname.startsWith(p))) return;
      const until = Number(localStorage.getItem(DISMISS) || 0);
      if (until && Date.now() < until) return;
      setShow(true);
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    if ((window as any)[LOADED]) return;
    (window as any)[LOADED] = true;
    if (document.getElementById(ADSTERRA.native.container)) {
      const s = document.createElement("script");
      s.async = true;
      s.setAttribute("data-cfasync", "false");
      s.src = ADSTERRA.native.invoke;
      document.body.appendChild(s);
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className="pointer-events-auto mx-auto w-full max-w-3xl px-4 pb-4">
      <div className="relative rounded-xl border border-border/50 bg-card/80 p-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
            Patrocínio
          </span>
          <button
            type="button"
            className="h-5 w-5 rounded-full border border-border inline-flex items-center justify-center text-muted-foreground"
            aria-label="Ocultar native 24h"
            onClick={() => {
              try {
                localStorage.setItem(DISMISS, String(Date.now() + 24 * 3600 * 1000));
              } catch {
                /* */
              }
              setShow(false);
            }}
          >
            <X size={10} />
          </button>
        </div>
        <div id={ADSTERRA.native.container} className="min-h-[80px]" />
      </div>
    </div>
  );
}
