const OCR_EXTERNAL_DISABLED = true;
/**
 * Motor OCR INTERNO — contrato compatível com self-host do Baidu Unlimited-OCR
 * (GPU/transformers NÃO rodam na Vercel; sobe o modelo num worker e aponta a URL).
 *
 * Env:
 *   UNLIMITED_OCR_URL  = https://seu-host/ocr  (POST multipart ou JSON base64)
 *   UNLIMITED_OCR_TOKEN = opcional Bearer
 *
 * Contrato esperado (qualquer um):
 *   POST JSON { image_base64, language? } → { text: string } | { result: string }
 *   POST multipart field "file" → { text: string }
 *
 * Referência de modelo: https://github.com/baidu/Unlimited-OCR
 */
import type { OcrResult } from './types';

export async function ocrUnlimitedInternal(
  buffer: Buffer,
  mimeType = 'image/png',
  language = 'por'
): Promise<OcrResult> {
  const base = (process.env.UNLIMITED_OCR_URL || process.env.LEXIS_OCR_INTERNAL_URL || '').trim();
  if (!base) {
    return {
      success: false,
      text: '',
      provider: 'unlimited_internal',
      error: 'UNLIMITED_OCR_URL não configurada (motor Unlimited-OCR self-host).',
    };
  }

  const started = Date.now();
  const token = (process.env.UNLIMITED_OCR_TOKEN || process.env.LEXIS_OCR_INTERNAL_TOKEN || '').trim();
  const b64 = buffer.toString('base64');

  try {
    // 1) JSON base64
    const res = await fetch(base, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        image_base64: b64,
        image: `data:${mimeType};base64,${b64}`,
        language,
        // dicas alinhadas ao uso jurídico
        task: 'ocr',
        prompt: 'Extract all text from the document image. Preserve line breaks.',
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const text = extractText(data);
      if (text) {
        return {
          success: true,
          text,
          provider: 'unlimited_internal',
          latencyMs: Date.now() - started,
        };
      }
    }

    // 2) multipart fallback
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), 'doc.png');
    form.append('language', language);
    const res2 = await fetch(base, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
      signal: AbortSignal.timeout(90_000),
    });
    if (!res2.ok) {
      return {
        success: false,
        text: '',
        provider: 'unlimited_internal',
        error: `Unlimited-OCR HTTP ${res2.status}`,
        latencyMs: Date.now() - started,
      };
    }
    const data2 = await res2.json().catch(() => ({}));
    const text2 = extractText(data2);
    return {
      success: !!text2,
      text: text2,
      provider: 'unlimited_internal',
      error: text2 ? undefined : 'Resposta sem texto',
      latencyMs: Date.now() - started,
    };
  } catch (e: any) {
    return {
      success: false,
      text: '',
      provider: 'unlimited_internal',
      error: e?.message || 'Falha Unlimited-OCR interno',
      latencyMs: Date.now() - started,
    };
  }
}

function extractText(data: any): string {
  if (!data) return '';
  if (typeof data === 'string') return data.trim();
  const candidates = [
    data.text,
    data.result,
    data.ocr,
    data.content,
    data.output,
    data.data?.text,
    data.choices?.[0]?.message?.content,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}
