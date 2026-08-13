/**
 * Alternativa EXTERNA — OCR.space (não é IA generativa).
 * Chave SOMENTE via env: OCR_SPACE_API_KEY
 * Nunca hardcode a key no repositório.
 */
import type { OcrResult } from './types';

export async function ocrSpaceExternal(
  buffer: Buffer,
  mimeType = 'image/png',
  language = 'por'
): Promise<OcrResult> {
  const apiKey = (process.env.OCR_SPACE_API_KEY || '').trim();
  if (!apiKey) {
    return {
      success: false,
      text: '',
      provider: 'ocrspace_external',
      error: 'OCR_SPACE_API_KEY não configurada no Vercel/env.',
    };
  }

  const started = Date.now();
  // OCR.space language codes: por, eng, ...
  const langMap: Record<string, string> = {
    por: 'por',
    pt: 'por',
    eng: 'eng',
    en: 'eng',
  };
  const lang = langMap[language] || 'por';

  try {
    const b64 = buffer.toString('base64');
    const body = new URLSearchParams();
    body.set('base64Image', `data:${mimeType};base64,${b64}`);
    body.set('language', lang);
    body.set('isOverlayRequired', 'false');
    body.set('OCREngine', '2');
    body.set('scale', 'true');
    body.set('detectOrientation', 'true');

    const res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(60_000),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || data?.IsErroredOnProcessing) {
      return {
        success: false,
        text: '',
        provider: 'ocrspace_external',
        error:
          data?.ErrorMessage?.toString?.() ||
          data?.ErrorDetails ||
          `OCR.space HTTP ${res.status}`,
        latencyMs: Date.now() - started,
      };
    }

    const parts = (data?.ParsedResults || [])
      .map((p: any) => String(p?.ParsedText || '').trim())
      .filter(Boolean);
    const text = parts.join('\n').trim();

    return {
      success: !!text,
      text,
      provider: 'ocrspace_external',
      error: text ? undefined : 'OCR.space retornou vazio',
      latencyMs: Date.now() - started,
    };
  } catch (e: any) {
    return {
      success: false,
      text: '',
      provider: 'ocrspace_external',
      error: e?.message || 'Falha OCR.space',
      latencyMs: Date.now() - started,
    };
  }
}
