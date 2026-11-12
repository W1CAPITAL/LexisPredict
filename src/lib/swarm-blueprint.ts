/**
 * Swarm Rebuild blueprint scheduler.
 * Every task represents actual measured DOM content captured at transition time.
 * No artificial cards, randomized targets or decorative-only pulses.
 */
export type SwarmKind = "box" | "text" | "media";
export type SwarmViewport = { width: number; height: number };
export type SwarmSource = {
  id: string;
  kind: SwarmKind;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type SwarmTask<T extends SwarmSource> = T & {
  agent: number;
  startMs: number;
  durationMs: number;
};

export const SWARM_MAX_NODES = 260;
export const SWARM_MAX_AGENTS = 16;
const DRAW_MS = { box: 920, text: 1060, media: 980 } as const;

export function planSwarmStoryboard<T extends SwarmSource>(
  sources: readonly T[],
  viewport: SwarmViewport,
): Array<SwarmTask<T>> {
  if (!viewport.width || !viewport.height) return [];
  const distinct = new Map<string, T>();
  for (const source of sources) {
    if (distinct.size >= SWARM_MAX_NODES) break;
    if (!source.id || distinct.has(source.id)) continue;
    if (![source.x, source.y, source.width, source.height].every(Number.isFinite)) continue;
    if (source.width < 3 || source.height < 3) continue;
    if (source.x >= viewport.width || source.y >= viewport.height ||
        source.x + source.width <= 0 || source.y + source.height <= 0) continue;
    distinct.set(source.id, source);
  }
  const ordered = Array.from(distinct.values()).sort((a, b) => {
    const ay = Math.floor(a.y / 18);
    const by = Math.floor(b.y / 18);
    if (ay !== by) return ay - by;
    if (Math.abs(a.x - b.x) > 32) return a.x - b.x;
    const rank = { box: 0, media: 1, text: 2 };
    return rank[a.kind] - rank[b.kind] || a.y - b.y;
  });
  const agents = Math.min(SWARM_MAX_AGENTS, Math.max(8, Math.ceil(ordered.length / 8)));
  return ordered.map((source, index) => ({
    ...source,
    agent: index % agents,
    startMs: Math.floor(index / agents) * 1050 + (index % agents) * 34,
    durationMs: DRAW_MS[source.kind],
  }));
}
