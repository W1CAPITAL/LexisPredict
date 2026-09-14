"use client";

import { useEffect, useState } from "react";
import { loadNavLayout, type NavLayoutMode } from "@/lib/nav-layout";
import { SidebarVertical } from "./sidebar-vertical";
import { SidebarDock } from "./sidebar-dock";

export function Sidebar() {
  const [mode, setMode] = useState<NavLayoutMode>("dock");

  useEffect(() => {
    setMode(loadNavLayout());
    const onChange = (event: Event) => {
      const next = (event as CustomEvent).detail?.mode as NavLayoutMode | undefined;
      setMode(next === "vertical" || next === "dock" ? next : loadNavLayout());
    };
    window.addEventListener("lexis-nav-layout", onChange);
    return () => window.removeEventListener("lexis-nav-layout", onChange);
  }, []);

  return mode === "vertical" ? <SidebarVertical /> : <SidebarDock />;
}
