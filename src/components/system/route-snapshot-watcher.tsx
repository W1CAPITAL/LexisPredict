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

    const requestIdle = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout?: number }) => number)
      | undefined;

    if (typeof requestIdle === "function") {
      idle = requestIdle(run, { timeout: 5000 });
    } else {
      timeout = globalThis.setTimeout(run, 3000);
    }

    return () => {
      cancelled = true;
      if (timeout) window.clearTimeout(timeout);
      const cancelIdle = (window as any).cancelIdleCallback as
        | ((id: number) => void)
        | undefined;
      if (idle != null && typeof cancelIdle === "function") {
        cancelIdle(idle);
      }
    };
  }, [pathname]);

  return null;
}
