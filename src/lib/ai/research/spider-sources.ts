/**
 * Opt-in Spider Cloud REST adapter for public legal pages.
 * No browsing of user/tenant private URLs; no automatic crawl, no redirects,
 * no storage in Supabase. Only explicit instructions with allowlisted URLs.
 *
 * https://aistudio.spider.cloud/docs/api/ (POST /scrape)
 */
export type SpiderSource = { name: string; kind: 'fonte_publica_spider'; text: string };

const OFFICIAL_SUFFIXES = ['gov.br', 'jus.br', 'cnj.jus.br', 'stf.jus.br', 'stj.jus.br'];
const RESEARCH_INTENT = /\b(pesquis\w*|consult\w*|verifiqu\w*|acesse|abrir|abra|busqu\w*)\b/i;

export function normalizeOfficialUrl(raw: string): string | null {
  try {
    if (raw.length > 2000 || /[\u0000-\u001f]/.test(raw)) return null;
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (!OFFICIAL_SUFFIXES.some((suffix) => host === suffix || host.endsWith('.' + suffix))) return null;
    if (/(?:token|secret|api[_-]?key|password|senha)=/i.test(url.search)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function explicitOfficialResearchUrls(instruction: string): string[] {
  const request = String(instruction || '').slice(0, 12000);
  if (!RESEARCH_INTENT.test(request)) return [];
  const raw = request.match(/https:\/\/[^\s<>"'\])}]+/gi) || [];
  const normalized = raw.map((x) => normalizeOfficialUrl(x.replace(/[.,;!?]+$/, ''))).filter((x): x is string => !!x);
  return [...new Set(normalized)].slice(0, 2);
}

export async function spiderPublicSources(instruction: string): Promise<SpiderSource[]> {
  const key = process.env.SPIDER_API_KEY;
  const urls = explicitOfficialResearchUrls(instruction);
  if (!key || !urls.length) return [];

  const requests = urls.map(async (url): Promise<SpiderSource | null> => {
    try {
      const response = await fetch('https://api.spider.cloud/scrape', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
        body: JSON.stringify({ url, return_format: 'markdown' }),
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
        redirect: 'error',
      });
      if (!response.ok) return null;
      const size = Number(response.headers.get('content-length') || 0);
      if (size > 100000) return null;
      const body = (await response.text()).slice(0, 100000);
      let parsed: unknown;
      try { parsed = JSON.parse(body); } catch { return null; }
      const entry = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!entry || typeof entry !== 'object') return null;
      const page = entry as Record<string, unknown>;
      if (Number(page.status || 200) >= 400 || typeof page.content !== 'string') return null;
      const text = page.content.slice(0, 8500).trim();
      if (!text) return null;
      return { name: 'Spider — ' + url + ' (consultado em ' + new Date().toISOString().slice(0, 10) + ')', kind: 'fonte_publica_spider', text };
    } catch {
      return null;
    }
  });
  const result = await Promise.allSettled(requests);
  return result.filter((r): r is PromiseFulfilledResult<SpiderSource | null> => r.status === 'fulfilled')
    .map((r) => r.value).filter((r): r is SpiderSource => !!r);
}
