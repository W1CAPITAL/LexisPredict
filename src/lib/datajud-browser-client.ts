"use client";

/**
 * Leitura interativa da API pública DataJud a partir do dispositivo do operador.
 *
 * A chave é a chave PÚBLICA divulgada pelo CNJ, não uma credencial do LexisPredict.
 * O navegador só poderá ler a resposta se a API liberar CORS/preflight.
 * Caso não libere, o scanner retorna diagnóstico e usa o servidor existente.
 * Nunca usa no-cors, CAPTCHA, cookies, certificado, proxy de terceiros ou HTML
 * de páginas autenticadas, e nunca reinterpreta falha como ausência de atos.
 */
import { getHermesNationalSourcePlan } from "@/lib/hermes-official-fallbacks";

const CNJ_PUBLIC_DATAJUD_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const DATAJUD_ORIGIN = "https://api-publica.datajud.cnj.jus.br";
const CORS_BACKOFF_MS = 10 * 60_000;
const RATE_LIMIT_BACKOFF_MS = 60_000;
const MAX_MOVEMENTS = 120;
let corsBackoffUntil = 0;
const rateLimitedUntilByTribunal = new Map<string, number>();

export type BrowserDataJudFailure =
  | "invalid_cnj" | "unknown_jurisdiction" | "browser_unavailable"
  | "browser_cooldown" | "network_error" | "timeout"
  | "rate_limited" | "auth_error" | "http_error"
  | "invalid_response" | "index_timeout" | "shard_failure"
  | "not_indexed" | "cnj_mismatch";

export type BrowserDataJudResult = {
  ok: boolean;
  found: boolean;
  movimentos: any[];
  reason?: BrowserDataJudFailure;
  error?: string;
  status?: number;
};

const invalid = (
  reason: BrowserDataJudFailure,
  error: string,
  status?: number,
): BrowserDataJudResult => ({ ok: false, found: false, movimentos: [], reason, error, status });

function rateLimitPause(response: Response): number {
  const value = response.headers?.get?.("Retry-After") || "";
  const numeric = /^\d+$/.test(value) ? Number(value) * 1000 : NaN;
  const date = Date.parse(value);
  const ms = Number.isFinite(numeric) ? numeric : Number.isFinite(date) ? date - Date.now() : RATE_LIMIT_BACKOFF_MS;
  return Math.max(RATE_LIMIT_BACKOFF_MS, Math.min(15 * 60_000, ms));
}

/** Consulta uma vez por clique/lote, sem repetição em erros 429 ou CORS.
 * Browser fetch é leitura local: o resultado não é automaticamente persistido
 * como movimento judicial auditado no banco de dados.
 */
export async function fetchDataJudDirectBrowser(
  rawCnj: string,
  options: { fast?: boolean; signal?: AbortSignal } = {},
): Promise<BrowserDataJudResult> {
  const cnj = String(rawCnj || "").replace(/\D/g, "");
  if (cnj.length !== 20) return invalid("invalid_cnj", "Número CNJ inválido.");
  if (typeof window === "undefined") return invalid("browser_unavailable", "Consulta direta disponível apenas no navegador.");
  const plan = getHermesNationalSourcePlan(cnj);
  const alias = plan?.alias || "";
  if (!/^[a-z0-9]{3,8}$/.test(alias)) return invalid("unknown_jurisdiction", "Tribunal não mapeado para a API pública do CNJ.");

  if (Date.now() < corsBackoffUntil) {
    return invalid("browser_cooldown",
      "Consulta direta suspensa nesta sessão após falha de acesso entre sites; usar servidor.");
  }
  if (Date.now() < (rateLimitedUntilByTribunal.get(alias) || 0)) {
    return invalid("rate_limited",
      "DataJud pediu uma pausa para este tribunal. Nenhuma nova requisição direta foi feita.", 429);
  }

  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(), options.fast ? 9_000 : 14_000);

  try {
    const response = await fetch(`${DATAJUD_ORIGIN}/api_publica_${alias}/_search`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      redirect: "error",
      headers: {
        Authorization: `APIKey ${CNJ_PUBLIC_DATAJUD_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        size: 1,
        query: { match: { numeroProcesso: cnj } },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 429) {
      rateLimitedUntilByTribunal.set(alias, Date.now() + rateLimitPause(response));
      return invalid("rate_limited", "API pública DataJud limitou consultas (HTTP 429).", 429);
    }
    if (response.status === 401 || response.status === 403) {
      return invalid("auth_error", "A chave pública ou a rede não foi aceita pelo DataJud.", response.status);
    }
    if (!response.ok) {
      return invalid("http_error", `DataJud respondeu HTTP ${response.status}.`, response.status);
    }

    const data: any = await response.json().catch(() => null);
    if (!data || typeof data !== "object") {
      return invalid("invalid_response", "DataJud retornou conteúdo que não é JSON válido.", response.status);
    }
    if (data.timed_out === true) {
      return invalid("index_timeout", "O próprio índice DataJud informou timeout; fonte não confirmada.", response.status);
    }
    if (Number(data?._shards?.failed || 0) > 0) {
      return invalid("shard_failure", "DataJud retornou shards incompletos; fonte não confirmada.", response.status);
    }
    const hits = data?.hits?.hits;
    if (!Array.isArray(hits)) {
      return invalid("invalid_response", "DataJud retornou resposta sem estrutura de pesquisa.", response.status);
    }
    const match = hits.find((hit: any) => String(hit?._source?.numeroProcesso || "").replace(/\D/g, "") === cnj)?._source;
    if (!match) {
      return invalid(
        hits.length ? "cnj_mismatch" : "not_indexed",
        hits.length
          ? "Índice retornou processo diferente; resposta descartada."
          : "CNJ não localizado nesta resposta do índice nacional; verificar a fonte no tribunal.",
        response.status,
      );
    }
    return {
      ok: true,
      found: true,
      movimentos: Array.isArray(match.movimentos)
        ? match.movimentos.filter((entry: unknown) => entry && typeof entry === "object").slice(0, MAX_MOVEMENTS)
        : [],
      status: response.status,
    };
  } catch (error) {
    if (controller.signal.aborted) {
      return invalid("timeout", options.signal?.aborted
        ? "Consulta direta interrompida."
        : "Tempo esgotado no DataJud pelo navegador.");
    }
    // TypeError no fetch cross-origin significa normalmente rede ou CORS;
    // não é possível distingui-los com segurança por JavaScript.
    if (error instanceof TypeError) {
      corsBackoffUntil = Date.now() + CORS_BACKOFF_MS;
      return invalid("network_error", "Navegador não conseguiu acessar o DataJud (rede ou CORS).");
    }
    return invalid("network_error", "Falha de rede na leitura direta do DataJud.");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancel);
  }
}
