"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureCurrentRoute } from "@/lib/route-snapshot-cache";

/**
 * Snapshot serve ao dock/preview desktop.
 * No mobile ele não traz benefício e a varredura do DOM causava jank após navegar.
 */
export function RouteSnapshotWatcher() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/login") || pathname.startsWith("/signup")) return;

    const media = window.matchMedia("(min-width: 768px)");
    if (!media.matches) return;

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let idle: number | null = null;

    const run = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      void captureCurrentRoute(pathname);
    };

    if ("requestIdleCallback" in window) {
      idle = (window as any).requestIdleCallback(run, { timeout: 5000 });
    } else {
      timeout = window.setTimeout(run, 3000);
    }

    return () => {
      cancelled = true;
      if (timeout) window.clearTimeout(timeout);
      if (idle != null && "cancelIdleCallback" in window) {
        (window as any).cancelIdleCallback(idle);
      }
    };
  }, [pathname]);

  return null;
}
