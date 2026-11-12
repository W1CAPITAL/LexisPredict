/** Pure, bounded selection of on-screen UI elements for the native rebuild. */
export const MAX_REBUILD_TARGETS = 12;
export const MOBILE_REBUILD_TARGETS = 6;

export type SwarmRect = { top: number; left: number; width: number; height: number };
export type SwarmViewport = { width: number; height: number };
export type SwarmCandidate = { rect: SwarmRect };

export function planSwarmTargets<T extends SwarmCandidate>(
  candidates: readonly T[],
  viewport: SwarmViewport,
  reducedMotion = false,
): T[] {
  if (reducedMotion || viewport.width <= 0 || viewport.height <= 0) return [];

  const limit = viewport.width <= 640 ? MOBILE_REBUILD_TARGETS : MAX_REBUILD_TARGETS;

  return candidates
    .filter(({ rect }) => {
      if (![rect.top, rect.left, rect.width, rect.height].every(Number.isFinite)) return false;
      if (rect.width < 96 || rect.height < 26) return false;
      if (rect.top >= viewport.height - 12 || rect.top + rect.height <= 35) return false;
      if (rect.left >= viewport.width - 12 || rect.left + rect.width <= 12) return false;
      // Never animate the full-page wrapper: it makes the entire screen blink.
      if (rect.width > viewport.width * 0.92 && rect.height > viewport.height * 0.7) return false;
      return true;
    })
    .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left)
    .slice(0, limit);
}
