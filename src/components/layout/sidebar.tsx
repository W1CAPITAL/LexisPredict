"use client";

import { useContext, useEffect, useState } from "react";
import { PersistentSidebarContext } from "./persistent-sidebar-context";
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
function SidebarContent() {
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
    window.addEventListener("storage", syncMode);

    return () => {
      media.removeEventListener?.("change", syncViewport);
      window.removeEventListener("lexis-nav-layout", onLayoutChange);
      window.removeEventListener("storage", syncMode);
    };
  }, []);

  if (!isDesktop) {
    return <SidebarVertical />;
  }

  return mode === "dock" ? <SidebarDock /> : <SidebarVertical />;
}


/**
 * Las páginas antiguas siguen declarando <Sidebar />. Cuando el shell global
 * ya está montado, esas instancias se convierten en no-op y no duplican ni
 * desmontan la navegación al cambiar de ruta.
 */
export function Sidebar({ persistentRoot = false }: { persistentRoot?: boolean }) {
  const inPersistentShell = useContext(PersistentSidebarContext);
  if (inPersistentShell && !persistentRoot) return null;
  return <SidebarContent />;
}
