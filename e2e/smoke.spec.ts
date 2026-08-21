import { test, expect } from "@playwright/test";

/**
 * Smoke e2e — não depende de login se a home redirecionar.
 * Ajuste seletores conforme a UI real.
 */
test.describe("smoke", () => {
  test("health endpoint responde ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.app).toBe("lexispredict");
  });

  test("version endpoint responde", async ({ request }) => {
    const res = await request.get("/api/version");
    // pode ser 200 com buildId ou 404 se rota mudar — só não pode 500
    expect(res.status()).toBeLessThan(500);
  });
});
