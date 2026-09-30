"use client";

import { useEffect, useState } from "react";
import { SidebarDock } from "./sidebar-dock";
import { SidebarVertical } from "./sidebar-vertical";
import {
  loadNavLayout,
  type NavLayoutMode,
} from "@/lib/nav-layout";

/**
 * Navegação adaptativa:
 * - mobile mantém o shell mobile oficial;
 * - desktop respeita a preferência Vertical ou Dock Horizontal.
 * A preferência é aplicada imediatamente pelo evento lexis-nav-layout.
 */
export function Sidebar() {
  const [mode, setMode] = useState<NavLayoutMode>("vertical");
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");

    const syncViewport = () => setIsDesktop(media.matches);
    const syncMode = () => setMode(loadNavLayout());
    const onLayoutChange = (event: Event) => {
      const next = (event as CustomEvent<{ mode?: NavLayoutMode }>).detail?.mode;
      if (next === "dock" || next === "vertical") {
        setMode(next);
        return;
      }
      syncMode();
    };

    syncViewport();
    syncMode();

    media.addEventListener?.("change", syncViewport);
    window.addEventListener("lexis-nav-layout", onLayoutChange);

    return () => {
      media.removeEventListener?.("change", syncViewport);
      window.removeEventListener("lexis-nav-layout", onLayoutChange);
    };
  }, []);

  if (!isDesktop) {
    return <SidebarVertical />;
  }

  return mode === "dock" ? <SidebarDock /> : <SidebarVertical />;
}
