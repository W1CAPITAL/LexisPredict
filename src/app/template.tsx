"use client";

import { SwarmRouteLoading } from "@/components/layout/swarm-route-loading";

/**
 * The real page is reconstructed in place. The persistent navigation stays
 * interactive, and no artificial loading overlay covers the screen.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div data-lexis-rebuild-root className="min-h-0 flex-1 flex flex-col">
      <SwarmRouteLoading />
      {children}
    </div>
  );
}
