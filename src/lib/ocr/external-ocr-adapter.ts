/** POLITICA_OCR_LOCAL_ONLY — produto não usa OCR externo. */
const OCR_EXTERNAL_DISABLED = true;

/**
 * Adapter OCR externo (ex.: host com Unlimited-OCR / Baidu / outro).
 * Env:
 *   LEXIS_OCR_ENDPOINT  — URL POST que aceita multipart ou JSON base64
 *   LEXIS_OCR_API_KEY   — opcional Bearer
 *   LEXIS_OCR_MODE      — 'multipart' | 'json' (default json)
 *
 * Contrato JSON esperado na resposta (flexível):
 *   { text: string } | { result: string } | { data: { text: string } }
 */

export type OcrAdapterResult = {
  ok: boolean;
  text: string;
  engine: string;
  latencyMs: number;
  error?: string;
};

export function isExternalOcrConfigured(): boolean {
  const ep = (process.env.LEXIS_OCR_ENDPOINT || '').trim();
  return ep.startsWith('http');
}

function extractTextFromPayload(data: any): string {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data.text === 'string') return data.text;
  if (typeof data.result === 'string') return data.result;
  if (typeof data.ocr === 'string') return data.ocr;
  if (data.data && typeof data.data.text === 'string') return data.data.text;
  if (Array.isArray(data.pages)) {
    return data.pages.map((p: any) => p?.text || p?.content || '').filter(Boolean).join('\n\n');
  }
  return '';
}

/** OCR via endpoint externo. Não falha o app se endpoint ausente. */
export async function runExternalOcr(input: {
  bytes: Uint8Array | Buffer;
  filename?: string;
  mimeType?: string;
}): Promise<OcrAdapterResult> {
  if (OCR_EXTERNAL_DISABLED) {
    return { ok: false, text: '', engine: 'disabled', latencyMs: 0, error: 'OCR externo desativado por política — use Tesseract local (/tools/ocr).' };
  }

  const endpoint = (process.env.LEXIS_OCR_ENDPOINT || '').trim();
  if (!endpoint.startsWith('http')) {
    return { ok: false, text: '', engine: 'external', latencyMs: 0, error: 'LEXIS_OCR_ENDPOINT não configurado' };
  }

  const key = (process.env.LEXIS_OCR_API_KEY || '').trim();
  const mode = (process.env.LEXIS_OCR_MODE || 'json').toLowerCase();
  const t0 = Date.now();

  try {
    const headers: Record<string, string> = {};
    if (key) headers['Authorization'] = `Bearer ${key}`;

    let res: Response;
    if (mode === 'multipart') {
      const form = new FormData();
      const blob = new Blob([new Uint8Array(input.bytes)], { type: input.mimeType || 'application/octet-stream' });
      form.append('file', blob, input.filename || 'document.bin');
      res = await fetch(endpoint, { method: 'POST', headers, body: form });
    } else {
      headers['Content-Type'] = 'application/json';
      const b64 = Buffer.from(input.bytes).toString('base64');
      res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filename: input.filename || 'document.bin',
          mimeType: input.mimeType || 'application/octet-stream',
          image_base64: b64,
        }),
      });
    }

    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return {
        ok: false,
        text: '',
        engine: 'external',
        latencyMs,
        error: `HTTP ${res.status}: ${errBody.slice(0, 200)}`,
      };
    }

    const ct = res.headers.get('content-type') || '';
    let text = '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      text = extractTextFromPayload(data);
    } else {
      text = await res.text();
    }

    text = String(text || '').trim();
    if (!text) {
      return { ok: false, text: '', engine: 'external', latencyMs, error: 'Resposta sem texto' };
    }
    return { ok: true, text, engine: 'external-ocr', latencyMs };
  } catch (e: any) {
    return {
      ok: false,
      text: '',
      engine: 'external',
      latencyMs: Date.now() - t0,
      error: e?.message || 'Falha de rede OCR externo',
    };
  }
}
