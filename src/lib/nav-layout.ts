/** Preferência de menu: dock horizontal (padrão) ou sidebar vertical. */

export type NavLayoutMode = "dock" | "vertical";

const KEY = "lexis_nav_layout_v1";

export function loadNavLayout(): NavLayoutMode {
  if (typeof window === "undefined") return "dock";
  try {
    const v = localStorage.getItem(KEY);
    if (v === "vertical" || v === "dock") return v;
  } catch {
    /* */
  }
  return "dock";
}

export function saveNavLayout(mode: NavLayoutMode) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, mode);
    window.dispatchEvent(new CustomEvent("lexis-nav-layout", { detail: { mode } }));
  } catch {
    /* */
  }
}
