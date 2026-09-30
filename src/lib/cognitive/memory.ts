export type MemorySnippet = {
  id: string;
  text: string;
  updatedAt?: string | number | Date;
  source?: string;
};

export type ScoredMemorySnippet = MemorySnippet & {
  score: number;
};

function normalize(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokens(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(/[^a-z0-9]+/i)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3)
  );
}

export function scoreMemorySnippet(query: string, snippet: MemorySnippet, now = Date.now()): number {
  const q = tokens(query);
  const s = tokens(snippet.text);
  if (!q.size || !s.size) return 0;

  let overlap = 0;
  for (const token of q) if (s.has(token)) overlap += 1;
  const lexical = overlap / Math.max(1, q.size);

  let recency = 0;
  if (snippet.updatedAt) {
    const ts = new Date(snippet.updatedAt).getTime();
    if (Number.isFinite(ts)) {
      const ageDays = Math.max(0, (now - ts) / 86_400_000);
      recency = Math.max(0, 1 - ageDays / 180) * 0.15;
    }
  }

  const sourceBoost = snippet.source ? 0.03 : 0;
  return Math.min(1, lexical * 0.82 + recency + sourceBoost);
}

export function retrieveMemory(
  query: string,
  snippets: MemorySnippet[],
  options: { limit?: number; minScore?: number } = {}
): ScoredMemorySnippet[] {
  const limit = Math.max(1, options.limit ?? 8);
  const minScore = options.minScore ?? 0.08;
  const seen = new Set<string>();

  return snippets
    .map((item) => ({ ...item, score: scoreMemorySnippet(query, item) }))
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      const key = normalize(item.text).replace(/\s+/g, ' ').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function compactMemory(
  snippets: Array<Pick<MemorySnippet, 'text' | 'source'>>,
  maxChars = 6000
): string {
  const chunks: string[] = [];
  let used = 0;

  for (const item of snippets) {
    const prefix = item.source ? `[${item.source}] ` : '';
    const chunk = `${prefix}${String(item.text || '').trim()}`.trim();
    if (!chunk) continue;
    if (used + chunk.length > maxChars) {
      const left = maxChars - used;
      if (left > 120) chunks.push(chunk.slice(0, left).trimEnd() + '…');
      break;
    }
    chunks.push(chunk);
    used += chunk.length + 2;
  }

  return chunks.join('\n\n');
}
