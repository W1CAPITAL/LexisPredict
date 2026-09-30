export type ScreenContextSearchResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
  latencyMs: number;
};

function baseUrl(): string {
  return String(process.env.SCREENPIPE_BASE_URL || '').trim().replace(/\/+$/, '');
}

export function isScreenpipeConfigured(): boolean {
  return /^https?:\/\//i.test(baseUrl());
}

export async function searchScreenContext(input: {
  query: string;
  limit?: number;
  contentType?: 'all' | 'ocr' | 'audio';
  startTime?: string;
}): Promise<ScreenContextSearchResult> {
  if (!isScreenpipeConfigured()) {
    return { ok: false, error: 'SCREENPIPE_BASE_URL não configurado.', latencyMs: 0 };
  }

  const query = String(input.query || '').trim();
  if (!query) return { ok: false, error: 'Consulta vazia.', latencyMs: 0 };

  const url = new URL(baseUrl() + '/search');
  url.searchParams.set('q', query.slice(0, 500));
  url.searchParams.set('limit', String(Math.max(1, Math.min(50, Math.floor(input.limit || 10)))));
  url.searchParams.set('content_type', input.contentType || 'all');
  if (input.startTime) url.searchParams.set('start_time', String(input.startTime).slice(0, 80));

  const token = String(process.env.SCREENPIPE_API_KEY || '').trim();
  const started = Date.now();

  try {
    const res = await fetch(url, {
      headers: {
        ...(token ? { authorization: 'Bearer ' + token } : {}),
        'x-screenpipe-client': 'api',
        'x-screenpipe-agent': 'lexispredict',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const raw = await res.text();
    let data: any = { text: raw };
    try {
      data = JSON.parse(raw);
    } catch {
      // texto simples é válido para diagnóstico
    }

    if (!res.ok) {
      return {
        ok: false,
        error: String((data as any)?.error || (data as any)?.message || 'Screenpipe HTTP ' + res.status),
        latencyMs: Date.now() - started,
      };
    }

    return { ok: true, data, latencyMs: Date.now() - started };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || 'Falha ao consultar Screenpipe',
      latencyMs: Date.now() - started,
    };
  }
}
