import { describe, it, expect } from "vitest";

/**
 * Smoke: garante que o módulo de health exporta GET e responde ok.
 * Não sobe servidor — só valida contrato mínimo.
 */
describe("health route contract", () => {
  it("GET returns ok shape", async () => {
    // Import dinâmico evita side-effects de Next em ambiente de teste
    const mod = await import("@/app/api/health/route");
    expect(typeof mod.GET).toBe("function");
    const res = await mod.GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.app).toBe("lexispredict");
    expect(typeof body.ts).toBe("string");
  });
});
