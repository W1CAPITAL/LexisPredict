/**
 * Enrichment (tel / e-mail / CPF / endereço) — **100% OPCIONAL**.
 *
 * Sem ENRICHMENT_LOOKUP_* o scan DJEN funciona normalmente.
 * Só tenta chamar a API se TODOS estiverem configurados E o usuário ligar o toggle.
 *
 * Env (opcionais):
 *   ENRICHMENT_LOOKUP_ENABLED=true|false   (default: false)
 *   ENRICHMENT_LOOKUP_URL=https://sua-api/...
 *   ENRICHMENT_LOOKUP_TOKEN=...
 *   ENRICHMENT_LOOKUP_TIMEOUT_MS=8000
 */

export type EnrichmentPayload = {
  nome?: string;
  processo?: string;
  telefone?: string;
  email?: string;
  cpf?: string;
  cnpj?: string;
  endereco?: string;
  cep?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  situacao_cadastral?: string;
  fonte?: string;
};

export function enrichmentIsOptional(): true {
  return true;
}

export function enrichmentConfigured(): boolean {
  const enabled = ["1", "true", "yes", "on"].includes(
    String(process.env.ENRICHMENT_LOOKUP_ENABLED || "").toLowerCase()
  );
  const url = String(process.env.ENRICHMENT_LOOKUP_URL || "").trim();
  const token = String(process.env.ENRICHMENT_LOOKUP_TOKEN || "").trim();
  return enabled && !!url && !!token;
}

export function enrichmentStatus() {
  const enabled = ["1", "true", "yes", "on"].includes(
    String(process.env.ENRICHMENT_LOOKUP_ENABLED || "").toLowerCase()
  );
  const urlSet = !!String(process.env.ENRICHMENT_LOOKUP_URL || "").trim();
  const tokenSet = !!String(process.env.ENRICHMENT_LOOKUP_TOKEN || "").trim();
  return {
    optional: true as const,
    enabled,
    urlSet,
    tokenSet,
    ready: enabled && urlSet && tokenSet,
    message: !enabled
      ? "Enrichment desligado (opcional). Scan DJEN funciona sem isso."
      : !urlSet || !tokenSet
        ? "Enrichment habilitado no env, mas URL/token ausentes — scan segue sem enrich."
        : "Enrichment pronto (opcional).",
  };
}

/** No-op seguro se não estiver configurado. Nunca lança. */
export async function lookupEnrichment(input: {
  nome: string;
  processo?: string;
}): Promise<EnrichmentPayload | null> {
  if (!enrichmentConfigured()) return null;
  const url = String(process.env.ENRICHMENT_LOOKUP_URL || "").trim();
  const token = String(process.env.ENRICHMENT_LOOKUP_TOKEN || "").trim();
  const timeoutMs = Math.min(
    Math.max(parseInt(process.env.ENRICHMENT_LOOKUP_TIMEOUT_MS || "8000", 10) || 8000, 2000),
    30000
  );
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ nome: input.nome, processo: input.processo || "" }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object") return null;
    return {
      nome: input.nome,
      processo: input.processo,
      telefone: String(data.telefone || data.phone || "").trim() || undefined,
      email: String(data.email || "").trim() || undefined,
      cpf: String(data.cpf || "").replace(/\D/g, "") || undefined,
      cnpj: String(data.cnpj || "").replace(/\D/g, "") || undefined,
      endereco: String(data.endereco || data.complemento || "").trim() || undefined,
      cep: String(data.cep || "").trim() || undefined,
      bairro: String(data.bairro || "").trim() || undefined,
      municipio: String(data.municipio || data.cidade || "").trim() || undefined,
      uf: String(data.uf || "").trim() || undefined,
      situacao_cadastral: String(data.situacao || data.situacao_cadastral || "").trim() || undefined,
      fonte: String(data.fonte || "enrichment_api").trim(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
