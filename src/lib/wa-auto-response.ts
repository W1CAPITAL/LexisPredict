/** A suspended WA.Auto host can return HTML instead of JSON. Never expose provider pages or treat them as success. */
export type WaAutoBody = Record<string, any> & { ok?: boolean; code?: string; error?: string };
export async function readWaAutoResponse(response: Response): Promise<WaAutoBody> {
  const raw = await response.text().catch(() => "");
  const snippet = raw.trimStart().slice(0, 2500);
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (/text\/html|application\/xhtml/i.test(contentType) ||
      /^(?:<!doctype\s+html\b|<html\b|<head\b|<body\b)/i.test(snippet)) {
    const suspended = /service\s+suspended|has been suspended by its owner/i.test(snippet);
    return {
      ok: false,
      code: suspended ? "provider_suspended" : "provider_html",
      error: suspended
        ? "O serviço WA.Auto está suspenso na hospedagem. O responsável deve reativá-lo; QR Code e envios não funcionam enquanto estiver suspenso."
        : `O servidor WA.Auto retornou HTML em vez da API (HTTP ${response.status}). Verifique a hospedagem e a URL configurada.`,
    };
  }
  if (!raw.trim()) return { ok: false, code: "provider_empty", error: `WA.Auto não retornou dados (HTTP ${response.status}).` };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return { ok: false, code: "provider_invalid", error: `Resposta inválida do WA.Auto (HTTP ${response.status}).` };
    const data = parsed as WaAutoBody;
    if (typeof data.error === "string" && /<!doctype|<html\b|<head\b|<body\b/i.test(data.error))
      return { ok: false, code: "provider_html", error: `WA.Auto retornou uma página HTML inesperada (HTTP ${response.status}).` };
    return data;
  } catch {
    return { ok: false, code: "provider_invalid", error: `O WA.Auto retornou conteúdo não JSON (HTTP ${response.status}).` };
  }
}
