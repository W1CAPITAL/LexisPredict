import { describe, expect, it } from "vitest";
import { resolveMotionCapacity } from "./fluid-motion-policy";

describe("Política de animação LexisPredict", () => {
  it("usa movimentos completos quando não há restrições", () => {
    expect(resolveMotionCapacity({ reducedMotion: false, saveData: false })).toBe("full");
    expect(resolveMotionCapacity({ reducedMotion: false, saveData: false, deviceMemory: 8, hardwareConcurrency: 8 })).toBe("full");
  });
  it("respeita movimento reduzido e economia de dados", () => {
    expect(resolveMotionCapacity({ reducedMotion: true, saveData: false })).toBe("lite");
    expect(resolveMotionCapacity({ reducedMotion: false, saveData: true })).toBe("lite");
  });
  it("reduz efeitos caros em aparelhos modestos sem bloquear a interface", () => {
    expect(resolveMotionCapacity({ reducedMotion: false, saveData: false, deviceMemory: 4, hardwareConcurrency: 8 })).toBe("lite");
    expect(resolveMotionCapacity({ reducedMotion: false, saveData: false, deviceMemory: 8, hardwareConcurrency: 2 })).toBe("lite");
  });
});
