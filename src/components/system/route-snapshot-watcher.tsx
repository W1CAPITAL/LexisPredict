"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { captureCurrentRoute } from "@/lib/route-snapshot-cache";

/** Após navegar e a página estabilizar, grava snapshot no cache local. */
export function RouteSnapshotWatcher() {
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/login") || pathname.startsWith("/signup")) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void captureCurrentRoute(pathname);
    }, 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pathname]);

  return null;
}
