/**
 * Fetch resiliente para APIs externas (DataJud, DJEN, IA…).
 * Não troca a lógica de negócio — só timeout, retry e circuit breaker leve.
 * @copyright 2026 W1 / LexisPredict
 */

export type FetchResilientOptions = RequestInit & {
  timeoutMs?: number;
  retries?: number;
  retryOn?: number[]; // HTTP statuses to retry
  backoffMs?: number;
  label?: string;
};

export type FetchResilientResult = {
  ok: boolean;
  status: number;
  latencyMs: number;
  response?: Response;
  error?: string;
  aborted?: boolean;
  rateLimited?: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Circuit breaker em memória por host (processo Node / edge isolate) */
const circuit: Record<
  string,
  { openUntil: number; fails: number }
> = {};

function hostKey(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

export function isCircuitOpen(url: string): boolean {
  const k = hostKey(url);
  const c = circuit[k];
  if (!c) return false;
  if (Date.now() > c.openUntil) {
    circuit[k] = { openUntil: 0, fails: 0 };
    return false;
  }
  return c.openUntil > Date.now();
}

function recordFail(url: string, status?: number) {
  const k = hostKey(url);
  const cur = circuit[k] || { openUntil: 0, fails: 0 };
  cur.fails += 1;
  // 429 ou 5 falhas → abre circuito 45–90s
  if (status === 429 || cur.fails >= 5) {
    cur.openUntil = Date.now() + (status === 429 ? 60_000 : 45_000);
  }
  circuit[k] = cur;
}

function recordOk(url: string) {
  const k = hostKey(url);
  circuit[k] = { openUntil: 0, fails: 0 };
}

/**
 * fetch com timeout + retries + backoff. Preserva Response em sucesso.
 */
export async function fetchResilient(
  url: string,
  opts: FetchResilientOptions = {}
): Promise<FetchResilientResult> {
  const timeoutMs = opts.timeoutMs ?? 28_000;
  const retries = opts.retries ?? 2;
  const retryOn = opts.retryOn ?? [429, 502, 503, 504];
  const backoffMs = opts.backoffMs ?? 900;
  const label = opts.label || hostKey(url);

  if (isCircuitOpen(url)) {
    return {
      ok: false,
      status: 0,
      latencyMs: 0,
      error: `Circuito aberto para ${label} — aguarde antes de nova tentativa.`,
      rateLimited: true,
    };
  }

  const { timeoutMs: _t, retries: _r, retryOn: _ro, backoffMs: _b, label: _l, ...init } =
    opts;

  let lastStatus = 0;
  let lastError = '';
  const startAll = Date.now();

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const t0 = Date.now();
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        cache: init.cache ?? 'no-store',
      });
      clearTimeout(timer);
      const latencyMs = Date.now() - t0;
      lastStatus = response.status;

      if (response.status === 429) {
        recordFail(url, 429);
        if (attempt < retries) {
          await sleep(backoffMs * attempt + ((attempt * 137) % 400));
          continue;
        }
        return {
          ok: false,
          status: 429,
          latencyMs,
          rateLimited: true,
          error: 'Taxa excedida (429).',
          response,
        };
      }

      if (retryOn.includes(response.status) && attempt < retries) {
        recordFail(url, response.status);
        await sleep(backoffMs * attempt);
        continue;
      }

      if (response.ok) recordOk(url);
      else if (response.status >= 500) recordFail(url, response.status);

      return {
        ok: response.ok,
        status: response.status,
        latencyMs,
        response,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (e: any) {
      clearTimeout(timer);
      const aborted = e?.name === 'AbortError' || /aborted|timeout/i.test(String(e?.message || ''));
      lastError = aborted
        ? `Timeout após ${timeoutMs}ms (${label})`
        : String(e?.message || e || 'Falha de rede');
      recordFail(url);
      if (attempt < retries) {
        await sleep(backoffMs * attempt);
        continue;
      }
      return {
        ok: false,
        status: lastStatus,
        latencyMs: Date.now() - startAll,
        error: lastError,
        aborted,
      };
    }
  }

  return {
    ok: false,
    status: lastStatus,
    latencyMs: Date.now() - startAll,
    error: lastError || 'Falha desconhecida',
  };
}

/** Allowlist de hosts externos usados pelo app (documentação + guardas futuras) */
export const EXTERNAL_API_HOSTS = [
  'api-publica.datajud.cnj.jus.br',
  'comunicaapi.pje.jus.br',
  'comunica.pje.jus.br',
  'api.x.ai',
  'api.groq.com',
  'api.openai.com',
] as const;

export function assertExternalHost(url: string): boolean {
  try {
    const h = new URL(url).host;
    return EXTERNAL_API_HOSTS.some((x) => h === x || h.endsWith('.' + x));
  } catch {
    return false;
  }
}
