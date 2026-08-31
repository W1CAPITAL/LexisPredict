"use client";

/**
 * Banner Adsterra 160×300 — só se NEXT_PUBLIC_ADSTERRA_KEY existir.
 * Fecha 24h. Sem popunder. Não entra em login.
 */
import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const DISMISS = "lexis_adsterra_160x300_until";
const KEY =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_ADSTERRA_KEY?.trim()) ||
  "";

export function Adsterra160x300() {
  const host = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!KEY) return;
      if (typeof window === "undefined") return;
      if (window.location.pathname.startsWith("/login")) return;
      const until = Number(localStorage.getItem(DISMISS) || 0);
      if (until && Date.now() < until) return;
      setShow(true);
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    if (!show || !KEY || !host.current) return;
    host.current.innerHTML = "";
    const s1 = document.createElement("script");
    s1.type = "text/javascript";
    s1.text = `atOptions = {
      'key' : '${KEY.replace(/'/g, "")}',
      'format' : 'iframe',
      'height' : 300,
      'width' : 160,
      'params' : {}
    };`;
    const s2 = document.createElement("script");
    s2.type = "text/javascript";
    s2.src = `https://www.highperformanceformat.com/${encodeURIComponent(KEY)}/invoke.js`;
    s2.async = true;
    host.current.appendChild(s1);
    host.current.appendChild(s2);
  }, [show]);

  if (!show) return null;

  return (
    <div className="relative mx-auto w-[160px] shrink-0">
      <button
        type="button"
        aria-label="Ocultar anúncio 24h"
        className="absolute -right-1 -top-1 z-10 h-5 w-5 rounded-full bg-background border border-border text-muted-foreground inline-flex items-center justify-center"
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
        className="h-[300px] w-[160px] overflow-hidden rounded-lg border border-border/60 bg-muted/30"
      />
    </div>
  );
}
