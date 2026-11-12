"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import {
  DOM_REBUILD_DURATION_MS,
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
const TAB_SELECTOR =
  '[role="tab"],[data-lexis-settings-tab],[data-lexis-dashboard-tablist] button,[data-lexis-tab]';
const OMIT_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "LINK", "META"]);
const MEDIA_TAGS = new Set(["IMG", "SVG", "CANVAS", "VIDEO"]);
const TEXT_TAGS = new Set([
  "H1", "H2", "H3", "H4", "H5", "P", "SPAN", "STRONG", "EM", "LABEL",
  "SMALL", "LI", "DT", "DD", "TH", "TD", "A", "BUTTON", "OPTION",
]);
const WORKERS = [
  ["Ada", "#0D99FF"], ["Linus", "#0ACF83"], ["Grace", "#A259FF"],
  ["Alan", "#F24E1E"], ["Margaret", "#E8467C"], ["Ken", "#FFC700"],
  ["Barbara", "#00B5CE"], ["Dennis", "#FF7262"], ["Radia", "#14AE5C"],
  ["Guido", "#9747FF"], ["Hedy", "#F24822"], ["Tim", "#1ABCFE"],
  ["Katherine", "#FF8A00"], ["Edsger", "#C056A4"], ["Joan", "#39B6D5"],
  ["Donald", "#7C6AE8"],
] as const;

function hasDirectText(element: Element) {
  return Array.from(element.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
  );
}
function isOnScreen(rect: DOMRect, width: number, height: number) {
  return rect.width > 2 && rect.height > 2 &&
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

/**
 * Capture only real visual nodes inside the route template.
 * The persistent app shell/sidebar is deliberately outside this boundary.
 */
function captureDomBlueprint(root: Element): RebuildElement[] {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const result: RebuildElement[] = [];
  const candidates = root.querySelectorAll("*");
  let visited = 0;

  for (const candidate of Array.from(candidates)) {
    if (visited++ >= 1800 || result.length >= DOM_REBUILD_MAX_ELEMENTS) break;
    if (!(candidate instanceof HTMLElement) && !(candidate instanceof SVGElement)) continue;
    const element = candidate as HTMLElement | SVGElement;
    if (OMIT_TAGS.has(element.tagName) || MEDIA_TAGS.has(element.tagName) && element.tagName === "VIDEO" && !(element as HTMLVideoElement).poster) continue;
    if (element.closest("[data-swarm-rebuild-stage]")) continue;
    if (element.hasAttribute("hidden") || element.closest('[hidden],[aria-hidden="true"]')) continue;
    if (element instanceof HTMLElement && element.isContentEditable) continue;

    const style = getComputedStyle(element);
    if (style.display === "none" || style.display === "contents" ||
        style.visibility !== "visible" || Number(style.opacity) < 0.04) continue;
    const rect = element.getBoundingClientRect();
    if (!isOnScreen(rect, viewport.width, viewport.height)) continue;

    const directText = hasDirectText(element);
    const media = MEDIA_TAGS.has(element.tagName);
    const surface = hasVisibleSurface(style);
    const text = directText && TEXT_TAGS.has(element.tagName);
    const semantic = element.matches(
      'button,a,input,select,textarea,[role="tab"],[role="tabpanel"],[data-lexis-tab]'
    );
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
    "padding:9px 12px;border-radius:10px;background:#202125;color:#fff;" +
    "font:600 11px system-ui;white-space:nowrap;box-shadow:0 4px 22px #0004;";
  label.textContent = "Swarm Rebuild · preparando elementos";
  stage.appendChild(label);

  const skip = document.createElement("button");
  skip.type = "button";
  skip.textContent = "Pular";
  skip.setAttribute("aria-label", "Pular reconstrução visual");
  skip.style.cssText =
    "position:absolute;left:calc(50% + 100px);bottom:18px;pointer-events:auto;" +
    "padding:8px 11px;border:0;border-radius:7px;background:#0D99FF;color:#fff;" +
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
      "pointer-events:none;transition:opacity 90ms linear;";
    const cursor = document.createElement("div");
    cursor.style.cssText =
      "position:fixed;left:0;top:0;display:flex;align-items:flex-start;gap:4px;" +
      "pointer-events:none;opacity:0;will-change:transform;" +
      "transition:transform 210ms cubic-bezier(.2,.7,.2,1),opacity 90ms linear;";
    const pointer = document.createElement("span");
    pointer.style.cssText =
      "display:block;width:0;height:0;border-top:0 solid transparent;" +
      "border-bottom:15px solid transparent;border-left:12px solid " + color +
      ";filter:drop-shadow(0 1px 1px #fff);";
    const tag = document.createElement("span");
    tag.textContent = name;
    tag.style.cssText =
      "margin-top:9px;padding:2px 5px;border-radius:2px;background:" + color +
      ";color:#fff;font:600 10px system-ui;white-space:nowrap;";
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
  const isInline = node.element instanceof HTMLElement &&
    ["inline", "inline-block", "inline-flex", "inline-grid"].includes(
      getComputedStyle(node.element).display
    );
  const from = isInline
    ? { opacity: 0, filter: "blur(2px)" }
    : { clipPath: "inset(0 100% 0 0)", opacity: Math.min(0.72, node.originalOpacity) };
  const to = isInline
    ? { opacity: node.originalOpacity, filter: node.originalFilter }
    : { clipPath: node.originalClipPath, opacity: node.originalOpacity };
  try {
    return node.element.animate([from, to], {
      duration: DOM_REBUILD_DURATION_MS,
      easing: "cubic-bezier(.18,.72,.22,1)",
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
  const originalNodes = captured;
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
    originalNodes.forEach(restoreOriginalVisibility);
    stage?.remove();
    stage = null;
  };

  // Conceal with visibility only: no dimensions, position, flex/grid or scroll
  // metrics change. Every element remains in its original DOM location.
  originalNodes.forEach(hideForRebuild);
  const overlay = createRebuildStage(cleanup, agentCount);
  stage = overlay.stage;
  label = overlay.label;
  cursors = overlay.cursors;

  const finishOne = () => {
    if (closed) return;
    completed += 1;
    if (label) label.textContent = "Swarm Rebuild · " + completed + "/" + tasks.length + " elementos";
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
          "translate3d(" + rect.left + "px," + (rect.top + Math.min(12, rect.height / 3)) + "px,0)";
      }

      const animation = revealOriginalElement(task);
      if (!animation) {
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
      animation.oncancel = () => {
        animations.delete(animation);
      };
    }, task.startMs);
    pending.add(timer);
  }

  const totalMs = Math.max(...tasks.map((task) => task.startMs + task.durationMs));
  watchdog = window.setTimeout(cleanup, totalMs + 1200);
  return cleanup;
}

function activeTabPanel(root: Element): Element {
  const selectedTab = root.querySelector<HTMLElement>(
    '[role="tab"][aria-selected="true"],[data-lexis-settings-tab][data-state="active"],[data-lexis-tab][aria-selected="true"]'
  );
  const controlledId = selectedTab?.getAttribute("aria-controls");
  if (controlledId) {
    const controlledPanel = document.getElementById(controlledId);
    if (controlledPanel && root.contains(controlledPanel)) return controlledPanel;
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

    let cleanup = startDomRebuild(root);
    let tabTimer = 0;
    let disposed = false;

    const queueTabRebuild = () => {
      window.clearTimeout(tabTimer);
      tabTimer = window.setTimeout(() => {
        if (disposed) return;
        cleanup();
        cleanup = startDomRebuild(activeTabPanel(root));
      }, 80);
    };

    const onTabClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const tab = target.closest<HTMLElement>(TAB_SELECTOR);
      if (!tab || !root.contains(tab)) return;
      if (tab.getAttribute("aria-selected") === "true" || tab.dataset.state === "active") return;
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
      window.clearTimeout(tabTimer);
      document.removeEventListener("click", onTabClick, true);
      document.removeEventListener("keydown", onTabKeyDown, true);
      cleanup();
    };
  }, [pathname]);

  return null;
}
