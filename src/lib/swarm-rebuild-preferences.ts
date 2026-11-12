/** User-controlled, device-local preferences for the optional visual rebuild. */
export type SwarmRebuildSpeed = 1 | 2 | 3 | 4 | 5;
export type SwarmRebuildPreferences = {
  enabled: boolean;
  speed: SwarmRebuildSpeed;
};
export type SwarmRebuildProfile = {
  label: string;
  durationMs: number;
  waveIntervalMs: number;
  maxElements: number;
  maxCandidates: number;
  agents: number;
};

export const SWARM_REBUILD_STORAGE_KEY = "lexis_swarm_rebuild_preferences_v1";
export const SWARM_REBUILD_PREFERENCES_EVENT = "lexis-swarm-rebuild-preferences-changed";
export const DEFAULT_SWARM_REBUILD_PREFERENCES: SwarmRebuildPreferences = {
  enabled: false,
  speed: 1,
};

const PROFILES: Record<SwarmRebuildSpeed, SwarmRebuildProfile> = {
  1: { label: "Muito lenta", durationMs: 820, waveIntervalMs: 860, maxElements: 48, maxCandidates: 180, agents: 4 },
  2: { label: "Lenta", durationMs: 650, waveIntervalMs: 690, maxElements: 48, maxCandidates: 180, agents: 4 },
  3: { label: "Normal", durationMs: 470, waveIntervalMs: 510, maxElements: 48, maxCandidates: 180, agents: 4 },
  4: { label: "Rápida", durationMs: 320, waveIntervalMs: 350, maxElements: 48, maxCandidates: 180, agents: 4 },
  5: { label: "Muito rápida", durationMs: 210, waveIntervalMs: 240, maxElements: 48, maxCandidates: 180, agents: 4 },
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeSwarmRebuildPreferences(value: unknown): SwarmRebuildPreferences {
  if (!value || typeof value !== "object") return { ...DEFAULT_SWARM_REBUILD_PREFERENCES };
  const candidate = value as Record<string, unknown>;
  const speed = candidate.speed;
  return {
    // Fail closed: malformed or absent settings must never enable page capture.
    enabled: candidate.enabled === true,
    speed: typeof speed === "number" && Number.isInteger(speed) && speed >= 1 && speed <= 5
      ? speed as SwarmRebuildSpeed
      : DEFAULT_SWARM_REBUILD_PREFERENCES.speed,
  };
}

export function loadSwarmRebuildPreferences(storage?: StorageLike): SwarmRebuildPreferences {
  const target = resolveStorage(storage);
  if (!target) return { ...DEFAULT_SWARM_REBUILD_PREFERENCES };
  try {
    const raw = target.getItem(SWARM_REBUILD_STORAGE_KEY);
    return raw ? normalizeSwarmRebuildPreferences(JSON.parse(raw)) : { ...DEFAULT_SWARM_REBUILD_PREFERENCES };
  } catch {
    return { ...DEFAULT_SWARM_REBUILD_PREFERENCES };
  }
}

export function saveSwarmRebuildPreferences(
  partial: Partial<SwarmRebuildPreferences>,
  storage?: StorageLike,
): SwarmRebuildPreferences {
  const target = resolveStorage(storage);
  const next = normalizeSwarmRebuildPreferences({
    ...loadSwarmRebuildPreferences(target ?? undefined),
    ...partial,
  });
  try {
    target?.setItem(SWARM_REBUILD_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A blocked or full localStorage must not break the settings screen.
  }
  if (!storage && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SWARM_REBUILD_PREFERENCES_EVENT, { detail: next }));
  }
  return next;
}

export function getSwarmRebuildProfile(speed: SwarmRebuildSpeed): SwarmRebuildProfile {
  return { ...PROFILES[speed] };
}
