import { describe, expect, it } from "vitest";
import {
  DOM_REBUILD_AGENTS,
  DOM_REBUILD_DURATION_MS,
  DOM_REBUILD_MAX_ELEMENTS,
  planDomRebuild,
} from "./swarm-dom-plan";
import { getSwarmRebuildProfile } from "./swarm-rebuild-preferences";

const source = (id: string, x: number, y: number, depth = 1) => ({
  id, x, y, depth, width: 120, height: 40, kind: "text" as const,
});

describe("native DOM rebuild schedule", () => {
  it("keeps each real element once and filters elements outside the viewport", () => {
    const tasks = planDomRebuild([
      source("heading", 20, 20),
      source("heading", 20, 20),
      source("offscreen", 1500, 20),
      { ...source("invalid", 10, 10), width: Number.NaN },
    ], { width: 1280, height: 800 });
    expect(tasks.map((task) => task.id)).toEqual(["heading"]);
  });

  it("preserves measured geometry and keeps parent layers before their text", () => {
    const tasks = planDomRebuild([
      source("child", 20, 22, 3),
      source("card", 10, 10, 2),
      source("shell", 0, 0, 1),
    ], { width: 1280, height: 800 });
    expect(tasks.map((task) => task.id)).toEqual(["child", "card", "shell"]);
    expect(tasks[1]).toMatchObject({ x: 10, y: 10, width: 120, height: 40 });
  });

  it("caps the rebuild at 48 real elements and four agents", () => {
    const items = Array.from({ length: 96 }, (_, i) =>
      source(String(i), (i % 8) * 150, Math.floor(i / 8) * 35));
    const tasks = planDomRebuild(items, { width: 1280, height: 800 });
    expect(DOM_REBUILD_MAX_ELEMENTS).toBe(48);
    expect(DOM_REBUILD_AGENTS).toBe(4);
    expect(tasks).toHaveLength(48);
    expect(new Set(tasks.map((task) => task.agent)).size).toBe(4);
  });

  it("keeps the slowest profile visible for more than eight seconds", () => {
    const profile = getSwarmRebuildProfile(1);
    const items = Array.from({ length: 48 }, (_, i) =>
      source(String(i), (i % 8) * 150, Math.floor(i / 8) * 35));
    const tasks = planDomRebuild(items, { width: 1280, height: 800 }, profile);
    expect(DOM_REBUILD_DURATION_MS).toBe(820);
    expect(tasks.every((task) => task.durationMs === 820)).toBe(true);
    const total = Math.max(...tasks.map((task) => task.startMs + task.durationMs));
    expect(total).toBeGreaterThanOrEqual(10_000);
  });

  it("reduces duration monotonically as the selected speed increases", () => {
    const durations = [1, 2, 3, 4, 5].map((speed) =>
      getSwarmRebuildProfile(speed as 1 | 2 | 3 | 4 | 5).durationMs);
    expect(durations).toEqual([...durations].sort((a, b) => b - a));
  });
});
