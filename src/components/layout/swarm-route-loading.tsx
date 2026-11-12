"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import {
  DOM_REBUILD_MAX_ELEMENTS,
  planDomRebuild,
  type DomRebuildSource,
} from "@/lib/swarm-dom-plan";

type RebuildElement = DomRebuildSource & {
  element: HTMLElement | SVGElement;
  originalVisibility: string;
  originalVisibilityPriority: string;
  originalClipPath: string;
  originalOpacity: number;
  originalFilter: string;
};

const ROOT_SELECTOR = "[data-lexis-rebuild-root]";
const TAB_SELECTOR = [
  '[role="tab"]',
  '[role="tablist"] button',
  "[data-lexis-settings-tab]",
  "[data-lexis-dashboard-tablist] button",
  "[data-lexis-tab]",
  ".tabs-trigger",
  "[data-tab-trigger]",
].join(",");
const CANDIDATE_SELECTOR = [
  "button", "a", "input", "select", "textarea",
  '[role="tab"]', '[role="tabpanel"]', '[role="button"]',
  "[data-slot='card']", "[data-lexis-rebuild-item]",
  "article", "section", "[class*='card']", "[class*='Card']",
  "h1", "h2", "h3", "h4", "h5", "p", "span", "strong", "em",
  "label", "small", "li", "dt", "dd", "th", "td",
  "img", "svg", "canvas",
].join(",");
const OMIT_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "LINK", "META"]);
const MEDIA_TAGS = new Set(["IMG", "SVG", "CANVAS"]);
const TEXT_TAGS = new Set([
  "H1", "H2", "H3", "H4", "H5", "P", "SPAN", "STRONG", "EM",
  "LABEL", "SMALL", "LI", "DT", "DD", "TH", "TD", "A", "BUTTON",
]);
const MAX_CANDIDATES = 900;
const WORKERS = [
  ["Ada", "#0D99FF"], ["Linus", "#0ACF83"], ["Grace", "#A259FF"],
  ["Alan", "#F24E1E"], ["Margaret", "#E8467C"], ["Ken", "#FFC700"],
  ["Barbara", "#00B5CE"], ["Dennis", "#FF7262"],
] as const;

function hasDirectText(element: Element) {
  return Array.from(element.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
  );
}
function isOnScreen(rect: DOMRect, width: number, height: number) {
  return Number.isFinite(rect.left) && Number.isFinite(rect.top) &&
    rect.width > 2 && rect.height > 2 &&
    rect.right > 0 && rect.bottom > 0 && rect.left < width && rect.top < height;
}
function hasVisibleSurface(style: CSSStyleDeclaration) {
  const color = style.backgroundColor.trim();
  const rgba = color.match(/^rgba\([^,]+,\s*[^,]+,\s*[^,]+,\s*([\d.]+)\)$/i);
  const transparent = color === "transparent" || Boolean(rgba && Number(rgba[1]) === 0);
  const hasBackground = !transparent || style.backgroundImage !== "none";
  const hasBorder = [
    style.borderTopWidth, style.borderRightWidth,
    style.borderBottomWidth, style.borderLeftWidth,
  ].some((width) => Number.parseFloat(width) > 0);
  return hasBackground || hasBorder || style.boxShadow !== "none";
}
function elementDepth(element: Element, root: Element) {
  let depth = 0;
  let parent = element.parentElement;
  while (parent && parent !== root) {
    depth += 1;
    parent = parent.parentElement;
  }
  return depth;
}
function isCompactSurface(rect: DOMRect, viewportWidth: number, viewportHeight: number) {
  // Never select the route wrapper, a full-width page background or a giant
  // section as a single "card". This avoids hiding/revealing the whole layout.
  return rect.width <= viewportWidth * 0.86 && rect.height <= viewportHeight * 0.78;
}

/**
 * Capture measured, visible objects from the route area only. Surface cards
 * are treated as one object; their child spans/text are not animated again.
 * This prevents the nested clipping and overlapping labels seen in the old
 * build while retaining independent headings, controls and standalone text.
 */
function captureDomBlueprint(root: Element): RebuildElement[] {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const result: RebuildElement[] = [];
  const surfaceAncestors = new WeakSet<Element>();
  const hasSurfaceAncestor = (element: Element) => {
    let parent = element.parentElement;
    while (parent && parent !== root) {
      if (surfaceAncestors.has(parent)) return true;
      parent = parent.parentElement;
    }
    return false;
  };

  const candidates = Array.from(root.querySelectorAll(CANDIDATE_SELECTOR))
    .slice(0, MAX_CANDIDATES)
    .sort((a, b) => elementDepth(a, root) - elementDepth(b, root));

  for (const candidate of candidates) {
    if (result.length >= DOM_REBUILD_MAX_ELEMENTS) break;
    if (!(candidate instanceof HTMLElement) && !(candidate instanceof SVGElement)) continue;
    const element = candidate as HTMLElement | SVGElement;
    if (OMIT_TAGS.has(element.tagName)) continue;
    if (element.closest("[data-swarm-rebuild-stage]")) continue;
    if (element.hasAttribute("hidden") || element.closest('[hidden],[aria-hidden="true"]')) continue;
    if (element instanceof HTMLElement && element.isContentEditable) continue;

    const style = getComputedStyle(element);
    if (style.display === "none" || style.display === "contents" ||
        style.visibility !== "visible" || Number(style.opacity) < 0.04) continue;
    const rect = element.getBoundingClientRect();
    if (!isOnScreen(rect, viewport.width, viewport.height)) continue;

    const media = MEDIA_TAGS.has(element.tagName);
    const surface = hasVisibleSurface(style) &&
      isCompactSurface(rect, viewport.width, viewport.height);
    const text = hasDirectText(element) && TEXT_TAGS.has(element.tagName);
    const semantic = element.matches(
      'button,a,input,select,textarea,[role="tab"],[role="tabpanel"],[role="button"],[data-lexis-tab]'
    );

    // A card's descendants remain part of that card's original rendering.
    // Keep a nested surface only when it is a separate visible control/card.
    if (hasSurfaceAncestor(element) && !surface) continue;
    if (!media && !surface && !text && !semantic) continue;

    const kind = media ? "media" : surface || semantic && !text ? "container" : "text";
    result.push({
      id: "dom-" + result.length,
      kind,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      depth: elementDepth(element, root),
      element,
      originalVisibility: element.style.getPropertyValue("visibility"),
      originalVisibilityPriority: element.style.getPropertyPriority("visibility"),
      originalClipPath: style.clipPath || "none",
      originalOpacity: Number(style.opacity) || 1,
      originalFilter: style.filter || "none",
    });
    if (surface) surfaceAncestors.add(element);
  }
  return result;
}

function restoreOriginalVisibility(node: RebuildElement) {
  if (node.originalVisibility) {
    node.element.style.setProperty(
      "visibility", node.originalVisibility, node.originalVisibilityPriority
    );
  } else {
    node.element.style.removeProperty("visibility");
  }
}
function hideForRebuild(node: RebuildElement) {
  // visibility does not alter width, height, flex/grid placement or scroll.
  node.element.style.setProperty("visibility", "hidden", "important");
}

function createRebuildStage(onSkip: () => void, agents: number) {
  const stage = document.createElement("div");
  stage.dataset.swarmRebuildStage = "true";
  stage.setAttribute("aria-label", "Reconstrução visual da página");
  stage.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;pointer-events:none;isolation:isolate;";

  const label = document.createElement("span");
  label.setAttribute("aria-live", "polite");
  label.style.cssText =
    "position:absolute;left:50%;bottom:18px;transform:translateX(-50%);" +
    "padding:8px 11px;border-radius:9px;background:#202125;color:#fff;" +
    "font:600 11px system-ui;white-space:nowrap;box-shadow:0 3px 16px #0003;";
  label.textContent = "Swarm Rebuild · preparando";
  stage.appendChild(label);

  const skip = document.createElement("button");
  skip.type = "button";
  skip.textContent = "Pular";
  skip.setAttribute("aria-label", "Pular reconstrução visual");
  skip.style.cssText =
    "position:absolute;left:calc(50% + 100px);bottom:18px;pointer-events:auto;" +
    "padding:7px 10px;border:0;border-radius:7px;background:#0D99FF;color:#fff;" +
    "font:600 11px system-ui;cursor:pointer;";
  skip.addEventListener("click", onSkip);
  stage.appendChild(skip);

  const cursors: Array<{ cursor: HTMLDivElement; outline: HTMLDivElement }> = [];
  for (let i = 0; i < agents; i++) {
    const [name, color] = WORKERS[i % WORKERS.length];
    const outline = document.createElement("div");
    outline.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;box-sizing:border-box;" +
      "border:1px dashed " + color + ";border-radius:4px;opacity:0;" +
      "pointer-events:none;will-change:opacity;";
    const cursor = document.createElement("div");
    cursor.style.cssText =
      "position:fixed;left:0;top:0;display:flex;align-items:flex-start;gap:4px;" +
      "pointer-events:none;opacity:0;will-change:transform,opacity;";
    const pointer = document.createElement("span");
    pointer.style.cssText =
      "display:block;width:0;height:0;border-top:0 solid transparent;" +
      "border-bottom:14px solid transparent;border-left:11px solid " + color +
      ";filter:drop-shadow(0 1px 1px #fff);";
    const tag = document.createElement("span");
    tag.textContent = name;
    tag.style.cssText =
      "margin-top:8px;padding:2px 4px;border-radius:2px;background:" + color +
      ";color:#fff;font:600 9px system-ui;white-space:nowrap;";
    cursor.append(pointer, tag);
    stage.append(outline, cursor);
    cursors.push({ cursor, outline });
  }
  document.body.appendChild(stage);
  return { stage, label, cursors };
}

function revealOriginalElement(node: RebuildElement): Animation | null {
  restoreOriginalVisibility(node);
  if (typeof node.element.animate !== "function") return null;
  const inline = node.element instanceof HTMLElement &&
    ["inline", "inline-block", "inline-flex", "inline-grid"].includes(
      getComputedStyle(node.element).display
    );
  const from = inline
    ? { opacity: 0, filter: "blur(1px)" }
    : { clipPath: "inset(0 100% 0 0)", opacity: Math.min(0.82, node.originalOpacity) };
  const to = inline
    ? { opacity: node.originalOpacity, filter: node.originalFilter }
    : { clipPath: node.originalClipPath, opacity: node.originalOpacity };
  try {
    return node.element.animate([from, to], {
      duration: 140,
      easing: "cubic-bezier(.2,.7,.25,1)",
      fill: "both",
    });
  } catch {
    return null;
  }
}

function startDomRebuild(root: Element): () => void {
  const captured = captureDomBlueprint(root);
  if (captured.length < 4) return () => {};
  const tasks = planDomRebuild(captured, {
    width: window.innerWidth,
    height: window.innerHeight,
  });
  if (!tasks.length) return () => {};

  let closed = false;
  let completed = 0;
  const pending = new Set<number>();
  const animations = new Set<Animation>();
  const agentCount = Math.max(...tasks.map((task) => task.agent)) + 1;
  let watchdog = 0;
  let stage: HTMLDivElement | null = null;
  let label: HTMLSpanElement | null = null;
  let cursors: Array<{ cursor: HTMLDivElement; outline: HTMLDivElement }> = [];

  const cleanup = () => {
    if (closed) return;
    closed = true;
    pending.forEach((timer) => window.clearTimeout(timer));
    pending.clear();
    window.clearTimeout(watchdog);
    animations.forEach((animation) => animation.cancel());
    animations.clear();
    captured.forEach(restoreOriginalVisibility);
    stage?.remove();
    stage = null;
  };

  captured.forEach(hideForRebuild);
  const overlay = createRebuildStage(cleanup, agentCount);
  stage = overlay.stage;
  label = overlay.label;
  cursors = overlay.cursors;

  const finishOne = () => {
    if (closed) return;
    completed += 1;
    if (label) label.textContent = "Swarm Rebuild · " + completed + "/" + tasks.length;
    if (completed >= tasks.length) cleanup();
  };

  for (const task of tasks) {
    const timer = window.setTimeout(() => {
      pending.delete(timer);
      if (closed) return;
      const element = task.element;
      if (!element.isConnected) {
        restoreOriginalVisibility(task);
        finishOne();
        return;
      }
      const rect = element.getBoundingClientRect();
      if (!isOnScreen(rect, window.innerWidth, window.innerHeight)) {
        restoreOriginalVisibility(task);
        finishOne();
        return;
      }

      const agent = cursors[task.agent];
      if (agent) {
        agent.outline.style.left = rect.left + "px";
        agent.outline.style.top = rect.top + "px";
        agent.outline.style.width = rect.width + "px";
        agent.outline.style.height = rect.height + "px";
        agent.outline.style.opacity = "1";
        agent.cursor.style.opacity = "1";
        agent.cursor.style.transform =
          "translate3d(" + rect.left + "px," + (rect.top + Math.min(10, rect.height / 3)) + "px,0)";
      }

      const animation = revealOriginalElement(task);
      if (!animation) {
        if (agent) {
          agent.outline.style.opacity = "0";
          agent.cursor.style.opacity = "0";
        }
        finishOne();
        return;
      }
      animations.add(animation);
      animation.onfinish = () => {
        if (closed) return;
        animation.cancel();
        animations.delete(animation);
        if (agent) {
          agent.outline.style.opacity = "0";
          agent.cursor.style.opacity = "0";
        }
        finishOne();
      };
      animation.oncancel = () => animations.delete(animation);
    }, task.startMs);
    pending.add(timer);
  }

  const totalMs = Math.max(...tasks.map((task) => task.startMs + task.durationMs));
  watchdog = window.setTimeout(cleanup, totalMs + 900);
  return cleanup;
}

function activeTabPanel(root: Element): Element {
  const selectedTab = root.querySelector<HTMLElement>(
    '[role="tab"][aria-selected="true"],[role="tab"][data-state="active"],' +
    '[data-lexis-settings-tab][aria-current="page"],[data-lexis-tab][data-state="active"]'
  );
  const controlledId = selectedTab?.getAttribute("aria-controls");
  if (controlledId) {
    const controlledPanel = document.getElementById(controlledId);
    if (controlledPanel && root.contains(controlledPanel)) return controlledPanel;
  }
  const href = selectedTab?.getAttribute("href");
  if (href?.startsWith("#")) {
    const target = document.getElementById(href.slice(1));
    if (target && root.contains(target)) return target;
  }
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
  return panels.find((panel) => {
    if (panel.hidden) return false;
    const style = getComputedStyle(panel);
    const rect = panel.getBoundingClientRect();
    return style.display !== "none" && style.visibility === "visible" &&
      rect.width > 0 && rect.height > 0;
  }) || root;
}

export function SwarmRouteLoading() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return;

    let cleanup = () => {};
    let routeTimer = 0;
    let tabTimer = 0;
    let disposed = false;

    // Wait one short frame for the route's committed layout. The capture is
    // restricted to a selector list and stops after 900 candidates / 96 nodes.
    routeTimer = window.setTimeout(() => {
      if (!disposed) cleanup = startDomRebuild(root);
    }, 48);

    const queueTabRebuild = () => {
      window.clearTimeout(tabTimer);
      tabTimer = window.setTimeout(() => {
        if (disposed) return;
        cleanup();
        cleanup = startDomRebuild(activeTabPanel(root));
      }, 110);
    };

    const onTabClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const tab = target.closest<HTMLElement>(TAB_SELECTOR);
      if (!tab || !root.contains(tab)) return;
      queueTabRebuild();
    };
    const onTabKeyDown = (event: KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Enter", " "].includes(event.key)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const tab = target.closest<HTMLElement>(TAB_SELECTOR);
      if (!tab || !root.contains(tab)) return;
      queueTabRebuild();
    };

    document.addEventListener("click", onTabClick, true);
    document.addEventListener("keydown", onTabKeyDown, true);
    return () => {
      disposed = true;
      window.clearTimeout(routeTimer);
      window.clearTimeout(tabTimer);
      document.removeEventListener("click", onTabClick, true);
      document.removeEventListener("keydown", onTabKeyDown, true);
      cleanup();
    };
  }, [pathname]);
  return null;
}
