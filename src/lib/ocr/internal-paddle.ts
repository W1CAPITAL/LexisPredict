import type { OcrResult } from './types';

export function isPaddleOcrConfigured(): boolean {
  const url = String(process.env.OCR_PADDLE_URL || '').trim();
  return /^https?:\/\//i.test(url);
}

function extractText(payload: any): string {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload.text === 'string') return payload.text;
  if (typeof payload.result === 'string') return payload.result;
  if (Array.isArray(payload.texts)) return payload.texts.filter(Boolean).join('\n');
  if (Array.isArray(payload.pages)) {
    return payload.pages
      .map((p: any) => p?.text || p?.content || '')
      .filter(Boolean)
      .join('\n\n');
  }
  if (payload.data) return extractText(payload.data);
  return '';
}

/**
 * Adapter opcional para PaddleOCR self-host.
 * Não inclui Paddle/Python no bundle Next.js.
 *
 * POST JSON:
 * { image_base64, mimeType, language }
 *
 * Resposta flexível:
 * { text } | { result } | { texts: [] } | { pages: [{ text }] }
 */
export async function ocrPaddleInternal(
  buffer: Buffer,
  mimeType = 'image/png',
  language = 'por'
): Promise<OcrResult> {
  const endpoint = String(process.env.OCR_PADDLE_URL || '').trim();
  if (!/^https?:\/\//i.test(endpoint)) {
    return {
      success: false,
      text: '',
      provider: 'paddle_internal',
      error: 'OCR_PADDLE_URL não configurado',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const started = Date.now();

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.OCR_PADDLE_TOKEN
          ? { authorization: `Bearer ${process.env.OCR_PADDLE_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        image_base64: buffer.toString('base64'),
        mimeType,
        language,
      }),
      signal: controller.signal,
    });

    const raw = await res.text();
    if (!res.ok) {
      return {
        success: false,
        text: '',
        provider: 'paddle_internal',
        latencyMs: Date.now() - started,
        error: `PaddleOCR HTTP ${res.status}: ${raw.slice(0, 180)}`,
      };
    }

    let parsed: any = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // plain text is accepted
    }

    const text = extractText(parsed).trim();
    if (!text) {
      return {
        success: false,
        text: '',
        provider: 'paddle_internal',
        latencyMs: Date.now() - started,
        error: 'PaddleOCR respondeu sem texto',
      };
    }

    return {
      success: true,
      text,
      provider: 'paddle_internal',
      latencyMs: Date.now() - started,
    };
  } catch (error: any) {
    return {
      success: false,
      text: '',
      provider: 'paddle_internal',
      latencyMs: Date.now() - started,
      error: error?.name === 'AbortError' ? 'PaddleOCR timeout' : error?.message || 'Falha PaddleOCR',
    };
  } finally {
    clearTimeout(timeout);
  }
}
