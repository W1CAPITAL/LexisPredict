import { describe, expect, it } from "vitest";
import { MAX_REBUILD_TARGETS, planSwarmTargets } from "./swarm-rebuild-plan";

const viewport = { width: 1360, height: 768 };
const box = (top: number, left: number, width = 240, height = 90) => ({
  rect: { top, left, width, height },
});

describe("planSwarmTargets", () => {
  it("keeps only visible on-screen real elements, skipping entire-page wrappers", () => {
    const items = [
      box(30, 120, 1000, 900),
      box(70, 150),
      box(190, 150),
      box(1300, 150),
      box(90, -300),
      box(320, 550),
    ];
    expect(planSwarmTargets(items, viewport).map(x => x.rect.top)).toEqual([70, 190, 320]);
  });

  it("reconstructs top-to-bottom and limits simultaneous elements", () => {
    const items = Array.from({ length: 60 }, (_, i) => box((i % 15) * 36 + 60, (i % 3) * 270 + 100, 200, 30));
    const result = planSwarmTargets(items, viewport);
    expect(result).toHaveLength(MAX_REBUILD_TARGETS);
    expect(result.map(x => x.rect.top)).toEqual([...result.map(x => x.rect.top)].sort((a, b) => a - b));
  });

  it("returns fewer elements on narrow screens and none for reduced motion", () => {
    const items = Array.from({ length: 15 }, (_, i) => box(i * 32 + 20, 30, 230, 30));
    expect(planSwarmTargets(items, { width: 375, height: 768 }).length).toBeLessThan(MAX_REBUILD_TARGETS);
    expect(planSwarmTargets(items, viewport, true)).toEqual([]);
  });
});
