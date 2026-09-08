/**
 * Enrichment via SUA API (telefone, e-mail, CPF, endereço…).
 * Lexis só faz POST; a lógica de consulta fica no seu serviço.
 *
 * Env:
 *   ENRICHMENT_LOOKUP_ENABLED=true
 *   ENRICHMENT_LOOKUP_URL=https://sua-api.com/v1/enrich
 *   ENRICHMENT_LOOKUP_TOKEN=seu-token
 *   ENRICHMENT_LOOKUP_TIMEOUT_MS=8000
 */

export type EnrichmentInput = {
  nome: string;
  cnj?: string | null;
  tribunal?: string | null;
  /** opcional: se já tiver documento */
  documento?: string | null;
  tipo?: "pessoa" | "empresa" | "auto";
};

/** Espelha campos típicos de retorno (PF ou PJ / Receita-like) */
export type EnrichmentResult = {
  ok: boolean;
  fonte?: string;
  confianca?: number;
  // contato
  telefone?: string | null;
  email?: string | null;
  // documentos
  cpf?: string | null;
  cnpj?: string | null;
  // endereço
  complemento?: string | null;
  cep?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  // empresa / cadastro
  situacao?: string | null;
  dt_situacao_cadastral?: string | null;
  situacao_especial?: string | null;
  entidade_federativo_responsavel?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  /** qualquer extra que sua API mandar */
  raw?: Record<string, unknown>;
  error?: string;
};

function envFlag(name: string): boolean {
  const v = String(process.env[name] || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function enrichmentConfigured(): boolean {
  return (
    envFlag("ENRICHMENT_LOOKUP_ENABLED") &&
    !!String(process.env.ENRICHMENT_LOOKUP_URL || "").trim() &&
    !!String(process.env.ENRICHMENT_LOOKUP_TOKEN || "").trim()
  );
}

export function enrichmentStatus(): {
  enabled: boolean;
  urlSet: boolean;
  tokenSet: boolean;
  ready: boolean;
} {
  const urlSet = !!String(process.env.ENRICHMENT_LOOKUP_URL || "").trim();
  const tokenSet = !!String(process.env.ENRICHMENT_LOOKUP_TOKEN || "").trim();
  const enabled = envFlag("ENRICHMENT_LOOKUP_ENABLED");
  return { enabled, urlSet, tokenSet, ready: enabled && urlSet && tokenSet };
}

function pickStr(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

/** Normaliza respostas no formato Receita-like ou genérico */
export function normalizeEnrichmentPayload(data: any): EnrichmentResult {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "payload vazio" };
  }
  if (data.ok === false) {
    return { ok: false, error: String(data.error || data.message || "não encontrado"), fonte: data.fonte };
  }

  const telefone = pickStr(data, ["telefone", "phone", "celular", "tel", "fone"]);
  const email = pickStr(data, ["email", "e_mail", "mail"]);
  const cpf = pickStr(data, ["cpf", "documento_cpf", "doc_cpf"]);
  const cnpj = pickStr(data, ["cnpj", "documento_cnpj", "doc_cnpj"]);
  const complemento = pickStr(data, ["complemento", "logradouro", "endereco", "address"]);
  const cep = pickStr(data, ["cep", "CEP"]);
  const bairro = pickStr(data, ["bairro"]);
  const municipio = pickStr(data, ["municipio", "cidade", "city"]);
  const uf = pickStr(data, ["uf", "UF", "estado"]);
  const situacao = pickStr(data, ["situacao", "situacao_cadastral"]);
  const dt_situacao_cadastral = pickStr(data, ["dt_situacao_cadastral", "data_situacao"]);
  const situacao_especial = pickStr(data, ["situacao especial", "situacao_especial"]);
  const entidade_federativo_responsavel = pickStr(data, [
    "entidade_federativo_responsavel",
    "entidade federativo responsavel",
  ]);
  const razao_social = pickStr(data, ["razao_social", "razão_social", "nome_empresarial"]);
  const nome_fantasia = pickStr(data, ["nome_fantasia", "fantasia"]);

  const hasAny = !!(
    telefone || email || cpf || cnpj || complemento || cep || bairro || municipio || uf || razao_social
  );

  return {
    ok: hasAny || data.ok === true,
    fonte: pickStr(data, ["fonte", "source", "provider"]) || "api-externa",
    confianca: typeof data.confianca === "number" ? data.confianca : undefined,
    telefone,
    email,
    cpf,
    cnpj,
    complemento,
    cep,
    bairro,
    municipio,
    uf,
    situacao,
    dt_situacao_cadastral,
    situacao_especial,
    entidade_federativo_responsavel,
    razao_social,
    nome_fantasia,
    raw: data,
  };
}

/**
 * Chama a API configurada. Retorna null se desligado / sem env / falha de rede.
 */
export async function lookupEnrichment(input: EnrichmentInput): Promise<EnrichmentResult | null> {
  if (!enrichmentConfigured()) return null;

  const nome = String(input.nome || "").trim();
  if (nome.length < 5) return null;

  const url = String(process.env.ENRICHMENT_LOOKUP_URL || "").trim();
  const token = String(process.env.ENRICHMENT_LOOKUP_TOKEN || "").trim();
  const timeoutMs = Math.min(
    Math.max(parseInt(process.env.ENRICHMENT_LOOKUP_TIMEOUT_MS || "8000", 10) || 8000, 2000),
    30000
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-Lexis-Enrichment": "1",
      },
      body: JSON.stringify({
        nome,
        cnj: input.cnj || null,
        tribunal: input.tribunal || null,
        documento: input.documento || null,
        tipo: input.tipo || "auto",
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, fonte: "api-externa" };
    }
    const data = await res.json().catch(() => null);
    return normalizeEnrichmentPayload(data);
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return { ok: false, error: "timeout", fonte: "api-externa" };
    }
    return { ok: false, error: e?.message || "falha fetch", fonte: "api-externa" };
  } finally {
    clearTimeout(timer);
  }
}
