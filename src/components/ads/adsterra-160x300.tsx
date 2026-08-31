"use client";

import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ADSTERRA, AD_PATH_BLOCK } from "@/lib/adsterra";

const DISMISS = "lexis_ad_160_until";
const LOADED = "lexis_ad_160_loaded";

export function Adsterra160x300() {
  const host = useRef<HTMLDivElement>(null);
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
    if (!show || !host.current) return;
    if ((window as any)[LOADED]) return;
    (window as any)[LOADED] = true;
    (window as any).atOptions = {
      key: ADSTERRA.banner160.key,
      format: "iframe",
      height: ADSTERRA.banner160.height,
      width: ADSTERRA.banner160.width,
      params: {},
    };
    const s = document.createElement("script");
    s.src = ADSTERRA.banner160.invoke;
    s.async = true;
    host.current.appendChild(s);
  }, [show]);

  if (!show) return null;

  return (
    <div className="relative mx-auto w-[160px] shrink-0 my-1">
      <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground text-center mb-1">
        Patrocínio
      </p>
      <button
        type="button"
        aria-label="Ocultar anúncio 24h"
        className="absolute -right-1 top-3 z-10 h-5 w-5 rounded-full bg-background border border-border text-muted-foreground inline-flex items-center justify-center"
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
      <div
        ref={host}
        className="h-[300px] w-[160px] overflow-hidden rounded-lg border border-border/50 bg-muted/20"
      />
    </div>
  );
}
