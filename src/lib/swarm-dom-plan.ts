/**
 * Deterministic, bounded schedule for revealing measured DOM nodes in place.
 * Query and layout work is only reached after explicit user opt-in.
 */
import {
  getSwarmRebuildProfile,
  type SwarmRebuildProfile,
} from "./swarm-rebuild-preferences";

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

export const DOM_REBUILD_MAX_ELEMENTS = 48;
export const DOM_REBUILD_AGENTS = 4;
export const DOM_REBUILD_DURATION_MS = getSwarmRebuildProfile(1).durationMs;

export function planDomRebuild<T extends DomRebuildSource>(
  sources: readonly T[],
  viewport: DomRebuildViewport,
  profile: SwarmRebuildProfile = getSwarmRebuildProfile(1),
): Array<DomRebuildTask<T>> {
  if (viewport.width <= 0 || viewport.height <= 0) return [];
  const unique = new Map<string, T>();
  for (const source of sources) {
    if (unique.size >= profile.maxElements) break;
    if (!source.id || unique.has(source.id)) continue;
    if (![source.x, source.y, source.width, source.height, source.depth].every(Number.isFinite)) continue;
    if (source.width < 2 || source.height < 2) continue;
    if (source.x >= viewport.width || source.y >= viewport.height ||
        source.x + source.width <= 0 || source.y + source.height <= 0) continue;
    unique.set(source.id, source);
  }

  // querySelectorAll already returns DOM order, so parent surfaces stay before
  // their children without an extra O(n log n) depth sort.
  const ordered = Array.from(unique.values());
  const agentCount = Math.min(profile.agents, ordered.length);
  return ordered.map((source, index) => ({
    ...source,
    agent: index % agentCount,
    startMs: Math.floor(index / agentCount) * profile.waveIntervalMs + (index % agentCount) * 45,
    durationMs: profile.durationMs,
  }));
}
