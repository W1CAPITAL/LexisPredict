import { describe, expect, it } from "vitest";
import { readWaAutoResponse } from "./wa-auto-response";

describe("WA.Auto response parsing", () => {
  it("converts a service suspension HTML into a safe readable error", async () => {
    const resp = new Response('<!DOCTYPE html><html lang="en"><title>Service Suspended</title><body>This service has been suspended by its owner.</body></html>', { status: 503, headers: { "content-type": "text/html" } });
    const r = await readWaAutoResponse(resp);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("provider_suspended");
    expect(r.error).not.toContain("<html");
  });
  it("rejects an HTML response with HTTP 200", async () => {
    const r = await readWaAutoResponse(new Response("<html><body>Proxy error</body></html>", { status: 200, headers: { "content-type": "text/html" } }));
    expect(r.ok).toBe(false);
    expect(r.code).toBe("provider_html");
  });
  it("never leaks unstructured upstream text", async () => {
    const r = await readWaAutoResponse(new Response("SECRET_INTERNAL_DEBUG_TEXT", { status: 502 }));
    expect(r.ok).toBe(false);
    expect(r.error).not.toContain("SECRET_INTERNAL_DEBUG_TEXT");
  });
  it("allows real provider JSON", async () => {
    const r = await readWaAutoResponse(new Response(JSON.stringify({ ok: true, connection: { status: "ready" } }), { headers: { "content-type": "application/json" } }));
    expect(r.ok).toBe(true);
    expect(r.connection.status).toBe("ready");
  });
});
