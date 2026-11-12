"use client";

import { useEffect, useState } from "react";
import { SwarmLoadingIndicator } from "@/components/ui/swarm-loading-indicator";

const SWARM_ROUTE_LOADING_MS = 560;

/**
 * Loading visual shared by every route template and every in-page tab.
 * It is intentionally visual-only: no DOM snapshot, page hiding, canvas,
 * extension APIs, network calls or interference with the content being loaded.
 */
export function SwarmRouteLoading() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let hideTimer: number | undefined;

    const scheduleHide = () => {
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setVisible(false), SWARM_ROUTE_LOADING_MS);
    };

    const handleTabClick = (event: MouseEvent) => {
      const tab =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[role="tab"]')
          : null;

      if (!tab || tab.getAttribute("aria-disabled") === "true") return;

      const alreadySelected =
        tab.getAttribute("aria-selected") === "true" || tab.dataset.state === "active";

      if (alreadySelected) return;

      setVisible(true);
      scheduleHide();
    };

    scheduleHide();
    document.addEventListener("click", handleTabClick, true);

    return () => {
      document.removeEventListener("click", handleTabClick, true);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
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
    </div>
  );
}
