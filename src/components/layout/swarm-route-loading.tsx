"use client";

import { useLayoutEffect, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { MousePointer2 } from "lucide-react";
import { MAX_REBUILD_TARGETS, planSwarmTargets } from "@/lib/swarm-rebuild-plan";

type RebuildMarker = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  travelX: number;
  travelY: number;
  delay: number;
  color: string;
  name: string;
};

type VisualTarget = {
  element: HTMLElement;
  rect: { top: number; left: number; width: number; height: number };
};

// Module state survives client-side navigation but resets on a hard refresh.
const seenRebuildRoutes = new Set<string>();
const seenRebuildTabs = new Set<string>();

const ROOT_SELECTOR = "[data-lexis-rebuild-root]";
const TAB_SELECTOR = '[role="tab"], [data-lexis-settings-tab]';
const VISUAL_SELECTOR =
  'h1,h2,h3,header,section,article,[role="tabpanel"],[class*="rounded-"],[class*="shadow-"],.lexis-metric,[data-lexis-dashboard-tablist]';
const TAB_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);
const AGENTS = [
  ["#0D99FF", "Ada"],
  ["#A259FF", "Grace"],
  ["#0ACF83", "Linus"],
  ["#F24E1E", "Alan"],
  ["#E8467C", "Hedy"],
  ["#FFC700", "Tim"],
] as const;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** Reconstructs visible, real page elements in place; no fake loading card or page screenshot. */
export function SwarmRouteLoading() {
  const pathname = usePathname();
  const [markers, setMarkers] = useState<RebuildMarker[]>([]);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const root =
      document.querySelector<HTMLElement>(ROOT_SELECTOR) ||
      document.querySelector<HTMLElement>("main") ||
      document.body;
    if (!root) return;

    setPortalRoot(document.body);
    const routeKey = pathname || window.location.pathname;
    const runRouteRebuild = !seenRebuildRoutes.has(routeKey);
    if (runRouteRebuild) seenRebuildRoutes.add(routeKey);

    const liveAnimations = new Set<Animation>();
    let hideTimer: number | undefined;
    let tabTimer: number | undefined;
    let lateTimer: number | undefined;
    let mutationTimer: number | undefined;
    let alreadyBuilt = new WeakSet<HTMLElement>();
    let markerGeneration = 0;

    const stopActive = () => {
      for (const animation of liveAnimations) animation.cancel();
      liveAnimations.clear();
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
      hideTimer = undefined;
    };

    const rebuild = (tabChange: boolean, onlyNew = false) => {
      if (!("animate" in HTMLElement.prototype)) {
        stopActive();
        setMarkers([]);
        return;
      }

      const viewport = { width: window.innerWidth, height: window.innerHeight };
      if (viewport.width <= 0 || viewport.height <= 0) return;

      const scope = tabChange
        ? root.querySelector<HTMLElement>('[role="tabpanel"][data-state="active"]') || root
        : root;

      // Bounded semantic query. No full DOM walk, screenshot capture or background polling.
      const candidates: VisualTarget[] = [];
      for (const element of Array.from(scope.querySelectorAll<HTMLElement>(VISUAL_SELECTOR)).slice(0, 180)) {
        if (element.closest("[data-lexis-swarm-stage]")) continue;
        const bounds = element.getBoundingClientRect();
        candidates.push({
          element,
          rect: {
            top: bounds.top,
            left: bounds.left,
            width: bounds.width,
            height: bounds.height,
          },
        });
      }

      const planned = planSwarmTargets(candidates, viewport);
      const targets: VisualTarget[] = [];
      for (const candidate of planned) {
        if (onlyNew && alreadyBuilt.has(candidate.element)) continue;
        if (targets.some(({ element }) => element.contains(candidate.element) || candidate.element.contains(element))) continue;
        targets.push(candidate);
        alreadyBuilt.add(candidate.element);
      }
      if (!targets.length) {
        setMarkers([]);
        return;
      }

      if (!onlyNew) stopActive();
      else if (hideTimer !== undefined) window.clearTimeout(hideTimer);

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const lightweight =
        viewport.width <= 640 ||
        (navigator.hardwareConcurrency || 4) <= 4 ||
        document.documentElement.getAttribute("data-lexis-motion") === "lite";

      // Even low-end devices get a visible wipe; only the number of targets is reduced.
      const shown = targets.slice(0, lightweight ? 8 : MAX_REBUILD_TARGETS);
      const staggerMs = prefersReducedMotion ? 0 : lightweight ? 78 : 84;
      const durationMs = prefersReducedMotion ? 180 : lightweight ? 620 : 760;

      shown.forEach(({ element, rect }, index) => {
        const computed = window.getComputedStyle(element);
        const area = rect.width * rect.height;
        const useMask =
          !prefersReducedMotion &&
          computed.clipPath === "none" &&
          area <= (lightweight ? 140_000 : 260_000);

        const frames: Keyframe[] = useMask
          ? [
              { opacity: 0.18, clipPath: "inset(0 100% 0 0)" },
              { opacity: 1, clipPath: "inset(0 0 0 0)" },
            ]
          : prefersReducedMotion
            ? [{ opacity: 0.72 }, { opacity: 1 }]
            : [{ opacity: 0.24 }, { opacity: 1 }];

        const animation = element.animate(frames, {
          duration: durationMs,
          delay: index * staggerMs,
          easing: "cubic-bezier(.16,1,.3,1)",
          fill: "both",
        });
        liveAnimations.add(animation);
        animation.addEventListener("finish", () => {
          animation.cancel();
          liveAnimations.delete(animation);
        }, { once: true });
      });

      const sampleEvery = Math.max(1, Math.ceil(shown.length / 6));
      const visualMarkers = prefersReducedMotion
        ? []
        : shown
            .filter((_, index) => index % sampleEvery === 0)
            .slice(0, 6)
            .map(({ rect }, index) => {
              const [color, name] = AGENTS[index % AGENTS.length];
              const width = Math.max(20, Math.min(rect.width, viewport.width - Math.max(0, rect.left)));
              const height = Math.max(16, Math.min(rect.height, viewport.height - Math.max(0, rect.top)));
              return {
                id: `${++markerGeneration}-${index}`,
                x: clamp(rect.left - 8, 0, Math.max(0, viewport.width - 28)),
                y: clamp(rect.top + Math.min(12, rect.height * 0.15), 0, Math.max(0, viewport.height - 32)),
                width,
                height,
                travelX: clamp(width * 0.72, 32, 220),
                travelY: clamp(height * 0.38, 14, 100),
                delay: index * (staggerMs * sampleEvery),
                color,
                name,
              };
            });

      setMarkers(visualMarkers);
      const total = shown.length * staggerMs + durationMs + 160;
      hideTimer = window.setTimeout(() => setMarkers([]), total);
    };

    const findTab = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>(TAB_SELECTOR) : null;

    const isSelected = (tab: HTMLElement) =>
      tab.getAttribute("aria-selected") === "true" ||
      tab.dataset.state === "active" ||
      tab.getAttribute("aria-current") === "page";

    const scheduleTabRebuild = (tab: HTMLElement) => {
      const tabName =
        tab.id ||
        tab.getAttribute("aria-controls") ||
        tab.getAttribute("data-lexis-settings-tab") ||
        tab.textContent?.replace(/\s+/g, " ").trim() ||
        "tab";
      const tabKey = `${routeKey}::${tabName}`;
      if (seenRebuildTabs.has(tabKey)) return;
      seenRebuildTabs.add(tabKey);

      if (tabTimer !== undefined) window.clearTimeout(tabTimer);
      // React/Radix has committed the selected tab by the next frame.
      tabTimer = window.setTimeout(() => {
        alreadyBuilt = new WeakSet<HTMLElement>();
        rebuild(true);
      }, 64);
    };

    const handlePointer = (event: PointerEvent) => {
      const tab = findTab(event.target);
      if (
        tab &&
        tab.getAttribute("aria-disabled") !== "true" &&
        tab.getAttribute("role") === "tab" &&
        !isSelected(tab)
      ) {
        scheduleTabRebuild(tab);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      const tab = findTab(event.target);
      if (!tab || tab.getAttribute("aria-disabled") === "true") return;
      const radixNavigation = tab.getAttribute("role") === "tab" && TAB_KEYS.has(event.key);
      const settingsActivation =
        tab.hasAttribute("data-lexis-settings-tab") &&
        (event.key === "Enter" || event.key === " ") &&
        !isSelected(tab);
      if (radixNavigation || settingsActivation) scheduleTabRebuild(tab);
    };

    const handleClick = (event: MouseEvent) => {
      const tab = findTab(event.target);
      if (!tab || tab.getAttribute("aria-disabled") === "true" || isSelected(tab)) return;
      // Custom settings buttons and assistive-technology clicks update on click.
      if (tab.hasAttribute("data-lexis-settings-tab") || event.detail === 0) {
        scheduleTabRebuild(tab);
      }
    };

    document.addEventListener("pointerdown", handlePointer, true);
    document.addEventListener("keydown", handleKey, true);
    document.addEventListener("click", handleClick, true);

    if (runRouteRebuild) {
      rebuild(false);
      lateTimer = window.setTimeout(() => rebuild(false, true), 340);

      // Server Components may stream the actual page after the first client paint.
      let mutationPasses = 0;
      const observer = new MutationObserver((records) => {
        if (mutationPasses >= 3 || !records.some((record) => record.addedNodes.length > 0)) return;
        if (mutationTimer !== undefined) window.clearTimeout(mutationTimer);
        mutationTimer = window.setTimeout(() => {
          if (mutationPasses < 3) {
            mutationPasses += 1;
            rebuild(false, true);
          }
          if (mutationPasses >= 3) observer.disconnect();
        }, 180);
      });
      observer.observe(root, { childList: true, subtree: true });
      const stopObserverTimer = window.setTimeout(() => observer.disconnect(), 12_000);

      return () => {
        document.removeEventListener("pointerdown", handlePointer, true);
        document.removeEventListener("keydown", handleKey, true);
        document.removeEventListener("click", handleClick, true);
        if (tabTimer !== undefined) window.clearTimeout(tabTimer);
        if (lateTimer !== undefined) window.clearTimeout(lateTimer);
        if (mutationTimer !== undefined) window.clearTimeout(mutationTimer);
        window.clearTimeout(stopObserverTimer);
        observer.disconnect();
        stopActive();
      };
    }

    return () => {
      document.removeEventListener("pointerdown", handlePointer, true);
      document.removeEventListener("keydown", handleKey, true);
      document.removeEventListener("click", handleClick, true);
      if (tabTimer !== undefined) window.clearTimeout(tabTimer);
      stopActive();
    };
  }, [pathname]);

  if (!portalRoot || markers.length === 0) return null;

  return createPortal(
    <div data-lexis-swarm-stage className="lx-swarm-stage" aria-hidden="true">
      {markers.map(({ id, x, y, width, height, travelX, travelY, delay, color, name }) => (
        <div key={id}>
          <span
            data-lexis-swarm-guide
            className="lx-swarm-guide"
            style={{
              left: x,
              top: y,
              width,
              height,
              animationDelay: `${delay}ms`,
              borderColor: color,
            }}
          />
          <span
            data-lexis-swarm-cursor
            className="lx-swarm-cursor"
            style={{
              left: x,
              top: y,
              animationDelay: `${delay}ms`,
              color,
              "--lx-swarm-travel-x": `${travelX}px`,
              "--lx-swarm-travel-y": `${travelY}px`,
              "--lx-swarm-mid-x": `${travelX * 0.46}px`,
              "--lx-swarm-mid-y": `${travelY * 0.46}px`,
            } as CSSProperties}
          >
            <MousePointer2 aria-hidden="true" size={18} fill="currentColor" strokeWidth={1.5} />
            <small style={{ backgroundColor: color }}>{name}</small>
          </span>
        </div>
      ))}
    </div>,
    portalRoot,
  );
}
