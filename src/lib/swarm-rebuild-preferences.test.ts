import { describe, expect, it } from "vitest";
import {
  DEFAULT_SWARM_REBUILD_PREFERENCES,
  SWARM_REBUILD_STORAGE_KEY,
  getSwarmRebuildProfile,
  loadSwarmRebuildPreferences,
  normalizeSwarmRebuildPreferences,
  saveSwarmRebuildPreferences,
} from "./swarm-rebuild-preferences";

function memoryStorage(initial?: Record<string, string>) {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe("preferências do Swarm Rebuild", () => {
  it("vem desativado por padrão e não liga sozinho em instalações existentes", () => {
    expect(DEFAULT_SWARM_REBUILD_PREFERENCES).toEqual({ enabled: false, speed: 1 });
    expect(loadSwarmRebuildPreferences(memoryStorage())).toEqual({
      enabled: false,
      speed: 1,
    });
  });

  it("normaliza valores inválidos sem habilitar a animação", () => {
    expect(normalizeSwarmRebuildPreferences({
      enabled: "yes",
      speed: 99,
    })).toEqual({ enabled: false, speed: 1 });
  });

  it("persiste o opt-in e a velocidade escolhida sem perder a outra preferência", () => {
    const storage = memoryStorage();
    saveSwarmRebuildPreferences({ enabled: true }, storage);
    const saved = saveSwarmRebuildPreferences({ speed: 4 }, storage);
    expect(storage.getItem(SWARM_REBUILD_STORAGE_KEY)).toBe(
      JSON.stringify({ enabled: true, speed: 4 }),
    );
    expect(saved).toEqual({ enabled: true, speed: 4 });
  });

  it("oferece cinco velocidades com duração progressivamente menor", () => {
    const profiles = [1, 2, 3, 4, 5].map((speed) =>
      getSwarmRebuildProfile(speed as 1 | 2 | 3 | 4 | 5),
    );
    expect(profiles.map((profile) => profile.durationMs)).toEqual(
      [...profiles.map((profile) => profile.durationMs)].sort((a, b) => b - a),
    );
    expect(profiles.every((profile) =>
      profile.maxElements <= 48 &&
      profile.maxCandidates <= 240 &&
      profile.agents <= 4
    )).toBe(true);
  });
});
