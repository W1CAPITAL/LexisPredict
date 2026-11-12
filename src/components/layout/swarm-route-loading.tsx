"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  planSwarmStoryboard,
  type SwarmKind,
  type SwarmSource,
  type SwarmTask,
} from "@/lib/swarm-blueprint";

/**
 * Native Swarm Rebuild.
 * Adaptation of the user-supplied extension's actual method:
 * measure the rendered page -> capture its boxes/text/media as a blueprint ->
 * paint those objects one by one on a blank canvas with several moving agents.
 * The real React tree is NEVER replaced, mutated, re-keyed or faked.
 */
type BlueprintNode = SwarmSource & {
  fill?: string;
  gradient?: string;
  border?: string;
  borderWidth?: number;
  radius?: number;
  text?: string;
  font?: string;
  textColor?: string;
  textAlign?: CanvasTextAlign;
  image?: CanvasImageSource;
};
type DrawTask = SwarmTask<BlueprintNode>;

const seenRebuildRoutes = new Set<string>();
const seenRebuildTabs = new Set<string>();
const WORKERS = [
  ["Ada", "#0D99FF"], ["Linus", "#0ACF83"], ["Grace", "#A259FF"],
  ["Alan", "#F24E1E"], ["Margaret", "#E8467C"], ["Ken", "#FFC700"],
  ["Barbara", "#00B5CE"], ["Dennis", "#FF7262"], ["Radia", "#14AE5C"],
  ["Guido", "#9747FF"], ["Hedy", "#F24822"], ["Tim", "#1ABCFE"],
  ["Katherine", "#FF8A00"], ["Edsger", "#C056A4"], ["Joan", "#39B6D5"],
  ["Donald", "#7C6AE8"],
] as const;
const TARGETS = '[role="tab"],[data-lexis-settings-tab],[data-lexis-dashboard-tablist] button';
const OMIT = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "LINK", "META"]);
const MAX_VISITED = 2400;
const MAX_CAPTURED = 260;

function visible(rect: DOMRect, width: number, height: number) {
  return Number.isFinite(rect.x) && rect.width > 2 && rect.height > 2 &&
    rect.bottom > 0 && rect.right > 0 && rect.top < height && rect.left < width;
}
function opaqueColor(color: string) {
  return color !== "transparent" && color !== "rgba(0, 0, 0, 0)" &&
    color !== "rgb(0 0 0 / 0)" && !color.endsWith(", 0)") &&
    !color.endsWith("/ 0)");
}
function resolvePageBackground(): string {
  const body = getComputedStyle(document.body).backgroundColor;
  if (opaqueColor(body)) return body;
  const html = getComputedStyle(document.documentElement).backgroundColor;
  return opaqueColor(html) ? html : "#ffffff";
}
function measureRect(rect: DOMRect) {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

/** Walk the real DOM once. Each measured visible leaf/box becomes one drawing task. */
function captureBlueprint(): BlueprintNode[] {
  const result: BlueprintNode[] = [];
  const walker = document.createTreeWalker(
    document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
  );
  const width = innerWidth;
  const height = innerHeight;
  let visited = 0;
  let id = 0;
  while (visited++ < MAX_VISITED && result.length < MAX_CAPTURED && walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.textContent || "";
      const text = raw.replace(/\s+/g, " ").trim();
      const parent = node.parentElement;
      if (!text || !parent || OMIT.has(parent.tagName) || parent.closest("[data-swarm-canvas-stage]")) continue;
      if (parent.closest('[aria-hidden="true"],[hidden]')) continue;
      const style = getComputedStyle(parent);
      if (style.visibility !== "visible" || style.display === "none" || style.opacity === "0") continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      range.detach();
      if (!visible(rect, width, height)) continue;
      result.push({
        id: "dom-text-" + (++id), kind: "text",
        ...measureRect(rect), text: text.slice(0, 500),
        font: style.font || (style.fontWeight + " " + style.fontSize + " " + style.fontFamily),
        textColor: style.color,
        textAlign: (style.textAlign === "center" || style.textAlign === "right")
          ? style.textAlign : "left",
      });
      continue;
    }
    if (!(node instanceof HTMLElement) && !(node instanceof SVGElement)) continue;
    const element = node as Element;
    if (OMIT.has(element.tagName) || element.closest("[data-swarm-canvas-stage]")) continue;
    if (element.hasAttribute("hidden") || element.closest('[aria-hidden="true"],[hidden]')) continue;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility !== "visible" || style.opacity === "0") continue;
    const rect = element.getBoundingClientRect();
    if (!visible(rect, width, height)) continue;

    // Actual pictures, charts, videos, icons and illustrations from the app.
    const mediaTag = element.tagName.toLowerCase();
    if (["img", "canvas", "svg", "video"].includes(mediaTag) && rect.width < width * 0.98) {
      let image: CanvasImageSource | undefined;
      if (element instanceof HTMLImageElement && element.complete && element.naturalWidth) image = element;
      if (element instanceof HTMLCanvasElement && element.width && element.height) image = element;
      if (element instanceof HTMLVideoElement && element.poster) {
        const poster = new Image();
        poster.src = element.poster;
        image = poster;
      }
      if (element instanceof SVGSVGElement) {
        try {
          const copy = element.cloneNode(true) as SVGSVGElement;
          copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
          copy.setAttribute("width", String(Math.max(1, rect.width)));
          copy.setAttribute("height", String(Math.max(1, rect.height)));
          copy.style.color = style.color;
          const text = new XMLSerializer().serializeToString(copy);
          const svgImage = new Image();
          svgImage.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(text);
          image = svgImage;
        } catch { /* An inaccessible icon does not stop reconstruction. */ }
      }
      if (image) {
        result.push({ id: "dom-media-" + (++id), kind: "media", ...measureRect(rect), image });
      }
      continue;
    }

    const bg = style.backgroundColor;
    const gradient = style.backgroundImage;
    const hasGradient = gradient.startsWith("linear-gradient(");
    const borderWidth = Math.max(
      parseFloat(style.borderTopWidth) || 0,
      parseFloat(style.borderRightWidth) || 0,
      parseFloat(style.borderBottomWidth) || 0,
      parseFloat(style.borderLeftWidth) || 0
    );
    const borderColor = style.borderTopColor;
    const hasFill = opaqueColor(bg);
    const hasBorder = borderWidth > 0 && opaqueColor(borderColor) &&
      style.borderTopStyle !== "none";
    if ((hasFill || hasBorder || hasGradient) && rect.width > 10 && rect.height > 8) {
      result.push({
        id: "dom-box-" + (++id), kind: "box",
        ...measureRect(rect), fill: hasFill ? bg : undefined,
        gradient: hasGradient ? gradient : undefined,
        border: hasBorder ? borderColor : undefined,
        borderWidth: borderWidth,
        radius: Math.max(0, parseFloat(style.borderTopLeftRadius) || 0),
      });
    }
    if (element instanceof HTMLInputElement &&
        ["text", "search", "email", "tel", "number", "password"].includes(element.type)) {
      const text = element.type === "password"
        ? "•".repeat(element.value.length)
        : (element.value || element.placeholder);
      if (text) result.push({
        id: "dom-input-" + (++id), kind: "text",
        ...measureRect(rect), x: rect.x + 10,
        width: Math.max(0, rect.width - 20), text,
        font: style.font, textColor: style.color,
      });
    }
  }
  return result;
}

function roundedPath(ctx: CanvasRenderingContext2D, task: BlueprintNode) {
  const r = Math.max(0, Math.min(task.radius || 0, task.width / 2, task.height / 2));
  ctx.beginPath();
  ctx.roundRect(task.x, task.y, task.width, task.height, r);
}
function paintText(ctx: CanvasRenderingContext2D, task: BlueprintNode, progress: number) {
  const text = (task.text || "").slice(0, Math.ceil((task.text || "").length * progress));
  if (!text) return;
  ctx.font = task.font || "14px system-ui";
  ctx.fillStyle = task.textColor || "#171717";
  ctx.textBaseline = "top";
  ctx.textAlign = task.textAlign || "left";
  const x = task.textAlign === "center" ? task.x + task.width / 2
    : task.textAlign === "right" ? task.x + task.width : task.x;
  const lineHeight = Math.max(12, (parseFloat(ctx.font.match(/[\d.]+px/)?.[0] || "") || 14) * 1.28);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const joined = line ? line + " " + word : word;
    if (ctx.measureText(joined).width > task.width && line) {
      lines.push(line);
      line = word;
    } else line = joined;
  }
  if (line) lines.push(line);
  const maxLines = Math.max(1, Math.ceil(task.height / lineHeight) + 1);
  lines.slice(0, maxLines).forEach((value, index) => {
    ctx.fillText(value, x, task.y + index * lineHeight, task.width);
  });
}
function gradientBrush(ctx: CanvasRenderingContext2D, task: BlueprintNode): CanvasGradient | string {
  const colors = (task.gradient || "").match(/rgba?\([^)]*\)|#[a-fA-F0-9]{3,8}/g) || [];
  if (colors.length < 2) return task.fill || "transparent";
  const value = task.gradient || "";
  const horizontal = /to right|90deg|270deg/.test(value);
  const reverse = /to top|to left|270deg|180deg/.test(value);
  const dx = horizontal ? task.width : task.width * 0.25;
  const dy = horizontal ? 0 : task.height;
  const g = ctx.createLinearGradient(
    task.x + (reverse ? dx : 0), task.y + (reverse ? dy : 0),
    task.x + (reverse ? 0 : dx), task.y + (reverse ? 0 : dy)
  );
  for (let i = 0; i < Math.min(6, colors.length); i++) {
    g.addColorStop(i / (Math.min(6, colors.length) - 1), colors[i]);
  }
  return g;
}

function paintItem(ctx: CanvasRenderingContext2D, task: BlueprintNode, progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  ctx.save();
  if (task.kind === "box") {
    roundedPath(ctx, task);
    if (task.fill || task.gradient) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = task.gradient ? gradientBrush(ctx, task) : (task.fill || "transparent");
      ctx.fillRect(task.x, task.y, task.width * p, task.height);
      ctx.restore();
    }
    if (task.border && p > 0.1) {
      ctx.strokeStyle = task.border;
      ctx.lineWidth = Math.max(0.5, Math.min(3, task.borderWidth || 1));
      ctx.globalAlpha = Math.min(1, p * 2);
      ctx.stroke();
    }
  } else if (task.kind === "text") {
    paintText(ctx, task, p);
  } else if (task.kind === "media" && task.image) {
    const source = task.image;
    if (source instanceof HTMLImageElement && !source.complete) { ctx.restore(); return; }
    try {
      ctx.beginPath();
      ctx.rect(task.x, task.y, task.width * p, task.height);
      ctx.clip();
      ctx.drawImage(source, task.x, task.y, task.width, task.height);
    } catch { /* tainted or cross-origin media: preserve normal live page */ }
  }
  ctx.restore();
}
function drawCursor(ctx: CanvasRenderingContext2D, task: DrawTask, progress: number) {
  const [name, color] = WORKERS[task.agent % WORKERS.length];
  const p = Math.max(0, Math.min(1, progress));
  // Agents travel along the actual captured object, not arbitrary random paths.
  const x = task.x + Math.max(0, task.width) * p;
  const y = task.kind === "text" ? task.y + task.height * 0.65 :
    task.y + task.height * (0.15 + 0.5 * p);
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.65;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(task.x, task.y, task.width, task.height);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 4, y + 18);
  ctx.lineTo(x + 9, y + 11);
  ctx.lineTo(x + 17, y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.font = "600 11px system-ui";
  const tagWidth = ctx.measureText(name).width + 10;
  const tagX = Math.max(2, Math.min(innerWidth - tagWidth - 2, x + 12));
  const tagY = Math.max(2, Math.min(innerHeight - 20, y + 20));
  ctx.fillRect(tagX, tagY, tagWidth, 19);
  ctx.fillStyle = "#fff";
  ctx.fillText(name, tagX + 5, tagY + 13);
  ctx.restore();
}

function installStage(onStop: () => void) {
  const stage = document.createElement("div");
  stage.dataset.swarmCanvasStage = "true";
  stage.style.cssText = [
    "all:initial", "position:fixed", "inset:0", "z-index:2147483645",
    "display:block", "pointer-events:auto", "contain:layout paint", "isolation:isolate",
  ].join(";");
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:100%;height:100%;display:block;";
  stage.appendChild(canvas);
  const hud = document.createElement("div");
  hud.style.cssText = [
    "position:absolute", "bottom:20px", "left:50%", "transform:translateX(-50%)",
    "display:flex", "align-items:center", "gap:10px", "max-width:96vw",
    "background:#202125", "color:#fff", "padding:9px 13px", "border-radius:12px",
    "font:12px system-ui", "box-shadow:0 4px 22px #0004",
  ].join(";");
  const label = document.createElement("span");
  label.style.cssText = "white-space:nowrap;font-weight:600;min-width:160px;";
  label.textContent = "Swarm Rebuild · Capturando...";
  hud.appendChild(label);
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Pular";
  button.style.cssText = "background:#0D99FF;color:white;border:0;border-radius:6px;padding:7px 10px;cursor:pointer;font:600 12px system-ui";
  button.addEventListener("click", onStop);
  hud.appendChild(button);
  stage.appendChild(hud);
  document.body.appendChild(stage);
  return { stage, canvas, label };
}

function playCapturedBlueprint(
  blueprint: BlueprintNode[],
  onFinish: () => void,
): () => void {
  let closed = false;
  let raf = 0;
  let scale = 1;
  const tasks = planSwarmStoryboard(blueprint, { width: innerWidth, height: innerHeight });
  if (tasks.length === 0) { onFinish(); return () => {}; }
  const { stage, canvas, label } = installStage(cleanup);
  const pixelRatio = innerWidth * innerHeight > 1_800_000 ? 1 : Math.min(1.25, window.devicePixelRatio || 1);
  canvas.width = Math.ceil(innerWidth * pixelRatio);
  canvas.height = Math.ceil(innerHeight * pixelRatio);
  const ctx = canvas.getContext("2d", { alpha: false });
  const buffer = document.createElement("canvas");
  buffer.width = canvas.width;
  buffer.height = canvas.height;
  const finishedCtx = buffer.getContext("2d");
  if (!ctx || !finishedCtx) {
    cleanup();
    return cleanup;
  }
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  finishedCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const background = resolvePageBackground();
  const finished = new Set<string>();
  const totalMs = Math.max(...tasks.map(t => t.startMs + t.durationMs)) + 600;
  const startTime = performance.now();
  let lastDraw = 0;

  function frame(now: number) {
    if (closed || !ctx || !finishedCtx) return;
    if (now - lastDraw < 28) { raf = requestAnimationFrame(frame); return; }
    lastDraw = now;
    const elapsed = (now - startTime) * scale;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    let completed = 0;
    for (const item of tasks) {
      if (elapsed < item.startMs) continue;
      const p = Math.min(1, (elapsed - item.startMs) / item.durationMs);
      if (p >= 1) {
        // Data/SVG images can decode a few frames after capturing the DOM.
        // Never mark an icon as finished while it still has no pixels.
        if (item.kind === "media" && item.image instanceof HTMLImageElement &&
            !item.image.complete) continue;
        if (!finished.has(item.id)) {
          paintItem(finishedCtx, item, 1);
          finished.add(item.id);
        }
        completed++;
      }
    }
    ctx.drawImage(buffer, 0, 0, innerWidth, innerHeight);
    for (const item of tasks) {
      if (elapsed < item.startMs || finished.has(item.id)) continue;
      const p = Math.max(0, Math.min(1, (elapsed - item.startMs) / item.durationMs));
      paintItem(ctx, item, p);
      drawCursor(ctx, item, p);
    }
    label.textContent = "Swarm Rebuild · " + completed + "/" + tasks.length + " elementos";
    if (elapsed > totalMs) { cleanup(); return; }
    raf = requestAnimationFrame(frame);
  }

  function cleanup() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    stage.remove();
    onFinish();
  }

  raf = requestAnimationFrame(frame);
  return cleanup;
}

export function SwarmRouteLoading() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const path = pathname || window.location.pathname;
    let cleanup: (() => void) | undefined;
    let timer = 0;
    let dead = false;
    let tries = 0;

    function run(key: string, seen: Set<string>) {
      if (dead || seen.has(key)) return;
      if (cleanup) cleanup();
      const blueprint = captureBlueprint();
      // Don't consume a route while its server-rendered data is still arriving.
      if (blueprint.length < 12 && tries < 6) {
        tries += 1;
        timer = window.setTimeout(() => run(key, seen), 260);
        return;
      }
      if (!blueprint.length) return;
      seen.add(key);
      cleanup = playCapturedBlueprint(blueprint, () => {
        cleanup = undefined;
      });
    }

    function schedule(key: string, seen: Set<string>, delay = 220) {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        tries = 0;
        run(key, seen);
      }, delay);
    }
    schedule(path, seenRebuildRoutes, 340);

    const onTab = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const tab = target.closest<HTMLElement>(TARGETS);
      if (!tab || tab.getAttribute("aria-disabled") === "true") return;
      if (tab.getAttribute("aria-selected") === "true" || tab.dataset.state === "active") return;
      const label = tab.id || tab.getAttribute("aria-controls") ||
        tab.getAttribute("data-lexis-settings-tab") || (tab.textContent || "").trim();
      const key = path + "::" + label;
      if (label) schedule(key, seenRebuildTabs, 240);
    };
    document.addEventListener("pointerdown", onTab, true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && cleanup) cleanup();
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      dead = true;
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onTab, true);
      document.removeEventListener("keydown", onKey, true);
      if (cleanup) cleanup();
    };
  }, [pathname]);
  return null;
}
