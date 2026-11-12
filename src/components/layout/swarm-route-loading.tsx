"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SwarmLoadingIndicator } from "@/components/ui/swarm-loading-indicator";

const SWARM_ROUTE_LOADING_MS = 560;
const TAB_SELECTOR = '[role="tab"], [data-lexis-settings-tab]';
const TAB_NAVIGATION_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

/**
 * Loading visual shared by every route template and every in-page tab.
 * Covers Radix tabs and the custom settings navigation. The overlay is portaled
 * to body so transformed route wrappers cannot trap its fixed positioning.
 */
export function SwarmRouteLoading() {
  const [visible, setVisible] = useState(true);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);

    let hideTimer: number | undefined;

    const scheduleHide = () => {
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setVisible(false), SWARM_ROUTE_LOADING_MS);
    };

    const showForTabChange = () => {
      setVisible(true);
      scheduleHide();
    };

    const findTab = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>(TAB_SELECTOR) : null;

    const isSelected = (tab: HTMLElement) =>
      tab.getAttribute("aria-selected") === "true" ||
      tab.dataset.state === "active" ||
      tab.getAttribute("aria-current") === "page";

    const handleTabPointerDown = (event: PointerEvent) => {
      const tab = findTab(event.target);
      if (!tab || tab.getAttribute("aria-disabled") === "true") return;

      // Pointerdown runs before Radix handles mousedown and updates its state.
      if (!isSelected(tab)) showForTabChange();
    };

    const handleTabKeyDown = (event: KeyboardEvent) => {
      const tab = findTab(event.target);
      if (!tab || tab.getAttribute("aria-disabled") === "true") return;

      const isRadixTab = tab.getAttribute("role") === "tab";
      const isSettingsTab = tab.hasAttribute("data-lexis-settings-tab");
      const radixNavigation = isRadixTab && TAB_NAVIGATION_KEYS.has(event.key);
      const settingsActivation =
        isSettingsTab &&
        (event.key === "Enter" || event.key === " ") &&
        !isSelected(tab);

      if (radixNavigation || settingsActivation) showForTabChange();
    };

    const handleTabClick = (event: MouseEvent) => {
      // Assistive technology may activate a tab with a detail=0 synthetic click.
      if (event.detail !== 0) return;

      const tab = findTab(event.target);
      if (!tab || tab.getAttribute("aria-disabled") === "true" || isSelected(tab)) return;

      showForTabChange();
    };

    scheduleHide();
    document.addEventListener("pointerdown", handleTabPointerDown, true);
    document.addEventListener("keydown", handleTabKeyDown, true);
    document.addEventListener("click", handleTabClick, true);

    return () => {
      document.removeEventListener("pointerdown", handleTabPointerDown, true);
      document.removeEventListener("keydown", handleTabKeyDown, true);
      document.removeEventListener("click", handleTabClick, true);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible || !portalRoot) return null;

  return createPortal(
    <div
      className="lx-swarm-route-loading"
      data-lexis-route-loading
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Reconstruindo a interface do LexisPredict"
    >
      <div className="lx-swarm-route-loading__panel">
        <div className="lx-swarm-route-loading__heading">
          <div className="lx-swarm-route-loading__brand">
            <span className="lx-swarm-route-loading__mark" aria-hidden="true">LP</span>
            <span className="lx-swarm-route-loading__brand-name">LexisPredict</span>
            <span className="lx-swarm-route-loading__tag">SWARM REBUILD</span>
          </div>
          <span className="lx-swarm-route-loading__live">
            <span aria-hidden="true" />
            AO VIVO
          </span>
        </div>

        <div className="lx-swarm-route-loading__preview" aria-hidden="true">
          <div className="lx-swarm-route-loading__rail">
            <i /><i /><i /><i /><i />
          </div>
          <div className="lx-swarm-route-loading__workspace">
            <div className="lx-swarm-route-loading__toolbar">
              <i /><i />
            </div>
            <div className="lx-swarm-route-loading__metrics">
              <i /><i /><i />
            </div>
            <div className="lx-swarm-route-loading__content">
              <i /><i />
            </div>
          </div>
          <div className="lx-swarm-route-loading__agents">
            <SwarmLoadingIndicator />
          </div>
        </div>

        <div className="lx-swarm-route-loading__caption">
          <strong>Reconstruindo a tela</strong>
          <span>Organizando painéis, abas e informações…</span>
        </div>

        <div className="lx-swarm-route-loading__progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
