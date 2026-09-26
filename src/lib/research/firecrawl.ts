export type FirecrawlSearchItem = {
  url: string;
  title: string;
  description?: string;
  markdown?: string;
};

export type FirecrawlResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  latencyMs: number;
};

function baseUrl(): string {
  const configured = String(process.env.FIRECRAWL_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  return 'https://api.firecrawl.dev/v2';
}

export function isFirecrawlConfigured(): boolean {
  return Boolean(String(process.env.FIRECRAWL_BASE_URL || '').trim() || String(process.env.FIRECRAWL_API_KEY || '').trim());
}

function headers(): Record<string, string> {
  const key = String(process.env.FIRECRAWL_API_KEY || '').trim();
  return {
    'content-type': 'application/json',
    ...(key ? { authorization: `Bearer ${key}` } : {}),
  };
}

export function isPublicHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
    if (host === '0.0.0.0' || host === '::1') return false;
    const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (m) {
      const [a,b] = m.slice(1).map(Number);
      if (a === 10 || a === 127 || a === 0) return false;
      if (a === 169 && b === 254) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function callFirecrawl<T>(path: string, body: unknown): Promise<FirecrawlResult<T>> {
  if (!isFirecrawlConfigured()) {
    return { ok: false, error: 'Firecrawl não configurado. Defina FIRECRAWL_API_KEY ou FIRECRAWL_BASE_URL.', latencyMs: 0 };
  }

  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    const raw = await res.text();
    let json: any = null;
    try { json = JSON.parse(raw); } catch { json = raw; }

    if (!res.ok) {
      const message =
        json?.error ||
        json?.message ||
        json?.details ||
        (typeof json === 'string' ? json.slice(0, 300) : `HTTP ${res.status}`);
      return { ok: false, error: String(message), latencyMs: Date.now() - started };
    }

    return { ok: true, data: json as T, latencyMs: Date.now() - started };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.name === 'TimeoutError' ? 'Firecrawl timeout' : error?.message || 'Falha Firecrawl',
      latencyMs: Date.now() - started,
    };
  }
}

export async function firecrawlSearch(query: string, limit = 5): Promise<FirecrawlResult<FirecrawlSearchItem[]>> {
  const q = String(query || '').trim();
  if (q.length < 2) return { ok: false, error: 'Consulta vazia.', latencyMs: 0 };

  const response = await callFirecrawl<any>('/search', {
    query: q.slice(0, 500),
    limit: Math.max(1, Math.min(10, Math.floor(limit || 5))),
  });
  if (!response.ok) return response as FirecrawlResult<FirecrawlSearchItem[]>;

  const raw = response.data;
  const rows =
    (Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.data?.web) ? raw.data.web : []) as any[];

  const data = rows
    .map((item) => ({
      url: String(item?.url || '').trim(),
      title: String(item?.title || item?.metadata?.title || item?.url || 'Resultado').trim(),
      description: String(item?.description || item?.metadata?.description || '').trim() || undefined,
      markdown: String(item?.markdown || item?.content || '').trim() || undefined,
    }))
    .filter((item) => isPublicHttpUrl(item.url));

  return { ok: true, data, latencyMs: response.latencyMs };
}

export async function firecrawlScrape(url: string): Promise<FirecrawlResult<{ url: string; title?: string; markdown: string }>> {
  const target = String(url || '').trim();
  if (!isPublicHttpUrl(target)) {
    return { ok: false, error: 'URL não pública ou inválida.', latencyMs: 0 };
  }

  const response = await callFirecrawl<any>('/scrape', {
    url: target,
    formats: ['markdown'],
    onlyMainContent: true,
  });
  if (!response.ok) return response as FirecrawlResult<{ url: string; title?: string; markdown: string }>;

  const payload = response.data?.data || response.data || {};
  return {
    ok: true,
    data: {
      url: target,
      title: payload?.metadata?.title || payload?.title || undefined,
      markdown: String(payload?.markdown || payload?.content || '').slice(0, 200_000),
    },
    latencyMs: response.latencyMs,
  };
}
