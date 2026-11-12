import { describe, expect, it } from "vitest";
import {
  DOM_REBUILD_AGENTS,
  DOM_REBUILD_DURATION_MS,
  DOM_REBUILD_MAX_ELEMENTS,
  planDomRebuild,
} from "./swarm-dom-plan";

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

  it("preserves measured geometry and puts parent layers before their text", () => {
    const tasks = planDomRebuild([
      source("child", 20, 22, 3),
      source("card", 10, 10, 2),
      source("shell", 0, 0, 1),
    ], { width: 1280, height: 800 });
    expect(tasks.map((task) => task.id)).toEqual(["shell", "card", "child"]);
    expect(tasks[1]).toMatchObject({ x: 10, y: 10, width: 120, height: 40 });
  });

  it("uses eight lightweight agents and finishes 96 real elements in under two seconds", () => {
    const items = Array.from({ length: DOM_REBUILD_MAX_ELEMENTS }, (_, i) =>
      source(String(i), (i % 8) * 150, Math.floor(i / 8) * 35));
    const tasks = planDomRebuild(items, { width: 1280, height: 800 });
    expect(DOM_REBUILD_MAX_ELEMENTS).toBe(96);
    expect(DOM_REBUILD_AGENTS).toBe(8);
    expect(new Set(tasks.map((task) => task.agent)).size).toBe(DOM_REBUILD_AGENTS);
    expect(tasks.every((task) => task.durationMs === DOM_REBUILD_DURATION_MS)).toBe(true);
    const total = Math.max(...tasks.map((task) => task.startMs + task.durationMs));
    expect(total).toBeLessThanOrEqual(1900);
  });
});