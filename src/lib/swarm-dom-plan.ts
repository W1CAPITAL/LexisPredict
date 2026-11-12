/**
 * Deterministic, bounded schedule for revealing measured DOM nodes in place.
 * Geometry is never fabricated: the caller supplies getBoundingClientRect data.
 */
export type DomRebuildKind = "container" | "text" | "media";
export type DomRebuildViewport = { width: number; height: number };
export type DomRebuildSource = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  kind: DomRebuildKind;
};
export type DomRebuildTask<T extends DomRebuildSource> = T & {
  agent: number;
  startMs: number;
  durationMs: number;
};

export const DOM_REBUILD_MAX_ELEMENTS = 96;
export const DOM_REBUILD_AGENTS = 8;
export const DOM_REBUILD_DURATION_MS = 140;
const WAVE_INTERVAL_MS = 150;

export function planDomRebuild<T extends DomRebuildSource>(
  sources: readonly T[],
  viewport: DomRebuildViewport,
): Array<DomRebuildTask<T>> {
  if (viewport.width <= 0 || viewport.height <= 0) return [];
  const unique = new Map<string, T>();
  for (const source of sources) {
    if (unique.size >= DOM_REBUILD_MAX_ELEMENTS) break;
    if (!source.id || unique.has(source.id)) continue;
    if (![source.x, source.y, source.width, source.height, source.depth].every(Number.isFinite)) continue;
    if (source.width < 2 || source.height < 2) continue;
    if (source.x >= viewport.width || source.y >= viewport.height ||
        source.x + source.width <= 0 || source.y + source.height <= 0) continue;
    unique.set(source.id, source);
  }

  // Keep the natural reading order while ensuring parent surfaces precede
  // nested controls and text. Each worker receives one element per wave.
  const ordered = Array.from(unique.values()).sort((a, b) =>
    a.y - b.y || a.depth - b.depth || a.x - b.x
  );
  const agentCount = Math.min(
    DOM_REBUILD_AGENTS,
    Math.max(4, Math.ceil(ordered.length / 12)),
  );
  return ordered.map((source, index) => ({
    ...source,
    agent: index % agentCount,
    startMs: Math.floor(index / agentCount) * WAVE_INTERVAL_MS + (index % agentCount) * 8,
    durationMs: DOM_REBUILD_DURATION_MS,
  }));
}
