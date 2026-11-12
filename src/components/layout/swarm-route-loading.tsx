"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MousePointer2 } from "lucide-react";
import { MAX_REBUILD_TARGETS, planSwarmTargets } from "@/lib/swarm-rebuild-plan";

type RebuildMarker = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  delay: number;
  color: string;
  name: string;
};

type VisualTarget = {
  element: HTMLElement;
  rect: { top: number; left: number; width: number; height: number };
};

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

/** Animates real viewport DOM nodes; never copies page content into an overlay. */
export function SwarmRouteLoading() {
  const [markers, setMarkers] = useState<RebuildMarker[]>([]);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>(ROOT_SELECTOR);
    if (!root) return;

    setPortalRoot(document.body);
    const liveAnimations = new Set<Animation>();
    let hideTimer: number | undefined;
    let tabTimer: number | undefined;
    let lateTimer: number | undefined;
    let alreadyBuilt = new WeakSet<HTMLElement>();

    const reduceMotion = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.getAttribute("data-lexis-motion") === "lite";

    const stopActive = () => {
      for (const animation of liveAnimations) animation.cancel();
      liveAnimations.clear();
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
      hideTimer = undefined;
    };

    const rebuild = (tabChange: boolean, onlyNew = false) => {
      if (reduceMotion() || !("animate" in HTMLElement.prototype)) {
        stopActive();
        setMarkers([]);
        return;
      }

      const viewport = { width: window.innerWidth, height: window.innerHeight };
      if (viewport.width <= 0 || viewport.height <= 0) return;

      const scope = tabChange
        ? root.querySelector<HTMLElement>('[role="tabpanel"][data-state="active"]') || root
        : root;

      // Bounded, semantic query; never scan every DOM node or build a page snapshot.
      const candidates: VisualTarget[] = [];
      for (const element of Array.from(scope.querySelectorAll<HTMLElement>(VISUAL_SELECTOR)).slice(0, 120)) {
        if (element.closest('[data-lexis-swarm-stage]')) continue;
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
      if (!targets.length) return;

      stopActive();

      // Reduced workload on weak notebooks and mobile devices.
      const lightweight =
        viewport.width <= 640 || (navigator.hardwareConcurrency || 4) <= 4;
      const shown = targets.slice(0, lightweight ? 6 : MAX_REBUILD_TARGETS);
      const staggerMs = lightweight ? 65 : 74;
      const durationMs = lightweight ? 260 : 380;

      shown.forEach(({ element, rect }, index) => {
        const useMask = !lightweight && rect.width * rect.height <= 180_000;
        const frames: Keyframe[] = useMask
          ? [
              { opacity: 0, clipPath: "inset(0 100% 0 0)", transform: "translate3d(0,5px,0)" },
              { opacity: 1, clipPath: "inset(0 0 0 0)", transform: "translate3d(0,0,0)" },
            ]
          : [
              { opacity: 0, transform: "translate3d(0,6px,0)" },
              { opacity: 1, transform: "translate3d(0,0,0)" },
            ];

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

      const sampleEvery = Math.max(1, Math.ceil(shown.length / (lightweight ? 3 : 6)));
      const visualMarkers = shown
        .filter((_, i) => i % sampleEvery === 0)
        .slice(0, lightweight ? 3 : 6)
        .map(({ rect }, index) => {
          const [color, name] = AGENTS[index % AGENTS.length];
          return {
            id: index,
            x: Math.max(0, Math.min(viewport.width - 30, rect.left)),
            y: Math.max(0, Math.min(viewport.height - 35, rect.top)),
            width: Math.max(20, Math.min(rect.width, viewport.width - Math.max(0, rect.left))),
            height: Math.max(16, Math.min(rect.height, viewport.height - Math.max(0, rect.top))),
            delay: index * (staggerMs * sampleEvery),
            color,
            name,
          };
        });

      setMarkers(visualMarkers);
      const total = shown.length * staggerMs + durationMs + 120;
      hideTimer = window.setTimeout(() => setMarkers([]), total);
    };

    const findTab = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>(TAB_SELECTOR) : null;

    const isSelected = (tab: HTMLElement) =>
      tab.getAttribute("aria-selected") === "true" ||
      tab.dataset.state === "active" ||
      tab.getAttribute("aria-current") === "page";

    const scheduleTabRebuild = () => {
      if (tabTimer !== undefined) window.clearTimeout(tabTimer);
      // React/Radix has committed the new tab content by the next frame.
      tabTimer = window.setTimeout(() => {
        alreadyBuilt = new WeakSet<HTMLElement>();
        rebuild(true);
      }, 48);
    };

    const handlePointer = (event: PointerEvent) => {
      const tab = findTab(event.target);
      if (tab && tab.getAttribute("aria-disabled") !== "true" && !isSelected(tab)) {
        scheduleTabRebuild();
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      const tab = findTab(event.target);
      if (!tab || tab.getAttribute("aria-disabled") === "true") return;
      const radixNavigation = tab.getAttribute("role") === "tab" && TAB_KEYS.has(event.key);
      const settingsActivation = tab.hasAttribute("data-lexis-settings-tab") &&
        (event.key === "Enter" || event.key === " ") && !isSelected(tab);
      if (radixNavigation || settingsActivation) scheduleTabRebuild();
    };

    const handleClick = (event: MouseEvent) => {
      if (event.detail !== 0) return;
      const tab = findTab(event.target);
      if (tab && tab.getAttribute("aria-disabled") !== "true" && !isSelected(tab)) {
        scheduleTabRebuild();
      }
    };

    document.addEventListener("pointerdown", handlePointer, true);
    document.addEventListener("keydown", handleKey, true);
    document.addEventListener("click", handleClick, true);

    // First paint rebuild plus one cheap pass for late-mounted page sections.
    rebuild(false);
    lateTimer = window.setTimeout(() => rebuild(false, true), 340);

    return () => {
      document.removeEventListener("pointerdown", handlePointer, true);
      document.removeEventListener("keydown", handleKey, true);
      document.removeEventListener("click", handleClick, true);
      if (tabTimer !== undefined) window.clearTimeout(tabTimer);
      if (lateTimer !== undefined) window.clearTimeout(lateTimer);
      stopActive();
    };
  }, []);

  if (!portalRoot || markers.length === 0) return null;

  return createPortal(
    <div data-lexis-swarm-stage className="lx-swarm-stage" aria-hidden="true">
      {markers.map(({ id, x, y, width, height, delay, color, name }) => (
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
              left: x + Math.min(width * 0.6, 100),
              top: y + Math.min(height * 0.45, 40),
              animationDelay: `${delay}ms`,
              color,
            }}
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
