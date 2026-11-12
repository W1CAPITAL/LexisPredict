import { describe, expect, it } from "vitest";
import {
  DOM_REBUILD_AGENTS,
  DOM_REBUILD_DURATION_MS,
  DOM_REBUILD_MAX_ELEMENTS,
  DOM_REBUILD_MIN_ELEMENTS,
  planDomRebuild,
  sampleDomCandidates,
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
      source("shell", 0, 0, 1),
      source("card", 10, 10, 2),
      source("child", 20, 22, 3),
    ], { width: 1280, height: 800 });
    expect(tasks.map((task) => task.id)).toEqual(["shell", "card", "child"]);
    expect(tasks[1]).toMatchObject({ x: 10, y: 10, width: 120, height: 40 });
  });

  it("caps the rebuild at 48 real elements and four agents", () => {
    const items = Array.from({ length: 96 }, (_, i) =>
      source(String(i), (i % 8) * 150, Math.floor(i / 8) * 35));
    const tasks = planDomRebuild(items, { width: 1280, height: 800 }, getSwarmRebuildProfile(5));
    expect(DOM_REBUILD_MAX_ELEMENTS).toBe(48);
    expect(DOM_REBUILD_AGENTS).toBe(4);
    expect(tasks).toHaveLength(48);
    expect(new Set(tasks.map((task) => task.agent)).size).toBe(4);
  });

  it("keeps the slowest profile visibly gradual for at least thirteen seconds", () => {
    const profile = getSwarmRebuildProfile(1);
    const items = Array.from({ length: 48 }, (_, i) =>
      source(String(i), (i % 8) * 150, Math.floor(i / 8) * 35));
    const tasks = planDomRebuild(items, { width: 1280, height: 800 }, profile);
    expect(DOM_REBUILD_DURATION_MS).toBe(1500);
    expect(tasks).toHaveLength(32);
    expect(tasks.every((task) => task.durationMs === 1500)).toBe(true);
    const total = Math.max(...tasks.map((task) => task.startMs + task.durationMs));
    expect(total).toBeGreaterThanOrEqual(13_000);
  });

  it("keeps a one-element tab panel eligible for reconstruction", () => {
    expect(DOM_REBUILD_MIN_ELEMENTS).toBe(1);
    const tasks = planDomRebuild([source("single-tab-item", 20, 20)], {
      width: 1280,
      height: 800,
    });
    expect(tasks.map((task) => task.id)).toEqual(["single-tab-item"]);
  });

  it("samples candidates across the full DOM instead of ignoring later panels", () => {
    const candidates = Array.from({ length: 1000 }, (_, index) => index);
    const sampled = sampleDomCandidates(candidates, 10);
    expect(sampled).toHaveLength(10);
    expect(sampled[0]).toBe(0);
    expect(sampled.at(-1)).toBe(999);
    expect(new Set(sampled).size).toBe(10);
  });

  it("reduces duration monotonically as the selected speed increases", () => {
    const durations = [1, 2, 3, 4, 5].map((speed) =>
      getSwarmRebuildProfile(speed as 1 | 2 | 3 | 4 | 5).durationMs);
    expect(durations).toEqual([...durations].sort((a, b) => b - a));
  });
});
