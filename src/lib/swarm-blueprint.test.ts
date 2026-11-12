import { describe, expect, it } from "vitest";
import { planSwarmStoryboard } from "./swarm-blueprint";

const viewport = { width: 1280, height: 800 };
const item = (id: string, kind: "box" | "text" | "media", x: number, y: number) => ({
  id, kind, x, y, width: 200, height: 40,
});

describe("Swarm Rebuild blueprint, based on real visible page content", () => {
  it("plans boxes, text and media, not just large cards", () => {
    const tasks = planSwarmStoryboard([
      item("card", "box", 100, 100),
      item("label", "text", 120, 110),
      item("icon", "media", 105, 112),
      item("button", "box", 100, 180),
    ], viewport);
    expect(tasks.map(x => x.id)).toEqual(["card", "icon", "label", "button"]);
    expect(new Set(tasks.map(x => x.kind))).toEqual(new Set(["box", "text", "media"]));
  });

  it("never draws a visual node more than once, and filters offscreen/invalid geometry", () => {
    const tasks = planSwarmStoryboard([
      item("one", "text", 45, 45),
      item("one", "text", 45, 45),
      item("offscreen", "box", 5000, 100),
      { ...item("invalid", "box", 10, 30), width: NaN },
    ], viewport);
    expect(tasks.map(x => x.id)).toEqual(["one"]);
  });

  it("coordinates a real multi-agent sequence instead of simultaneous random fades", () => {
    const items = Array.from({ length: 120 }, (_, i) =>
      item(String(i), i % 3 === 0 ? "box" : i % 3 === 1 ? "text" : "media", 40 + (i % 6) * 190, 30 + Math.floor(i / 6) * 35));
    const tasks = planSwarmStoryboard(items, viewport);
    expect(tasks.length).toBe(120);
    expect(new Set(tasks.map(t => t.agent)).size).toBeGreaterThanOrEqual(8);
    expect(Math.max(...tasks.map(t => t.startMs + t.durationMs))).toBeGreaterThan(5000);
    expect(tasks.every(t => t.durationMs >= 700)).toBe(true);
    expect(tasks.every(t => t.startMs >= 0)).toBe(true);
  });
});
