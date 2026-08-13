/**
 * Motor OCR Lexis — prioridade:
 * 1) Unlimited-OCR interno (self-host GPU) — base Baidu Unlimited-OCR
 * 2) Tesseract interno (sem rede, sem IA)
 * 3) OCR.space externo (alternativa; não é LLM)
 *
 * NÃO usa Gemini / xAI / Claude / GPT para OCR.
 */
import type { OcrInput, OcrResult } from './types';
import { ocrUnlimitedInternal } from './internal-unlimited';
import { ocrTesseractInternal } from './internal-tesseract';
import { ocrSpaceExternal } from './external-ocrspace';

export async function runOcr(input: OcrInput): Promise<OcrResult> {
  const mime = input.mimeType || 'image/png';
  const lang = input.language || 'por';
  const prefer = input.prefer || 'auto';

  const errors: string[] = [];

  if (prefer === 'external') {
    const ext = await ocrSpaceExternal(input.buffer, mime, lang);
    if (ext.success) return ext;
    errors.push(ext.error || 'ocrspace fail');
    // se externo falhar, ainda tenta interno
  }

  if (prefer !== 'external') {
    // 1) Unlimited self-host
    const u = await ocrUnlimitedInternal(input.buffer, mime, lang);
    if (u.success && u.text.trim()) return u;
    if (u.error) errors.push(`[unlimited] ${u.error}`);

    // 2) Tesseract local
    const t = await ocrTesseractInternal(input.buffer, lang);
    if (t.success && t.text.trim()) return t;
    if (t.error) errors.push(`[tesseract] ${t.error}`);
  }

  if (prefer !== 'internal') {
    const ext = await ocrSpaceExternal(input.buffer, mime, lang);
    if (ext.success && ext.text.trim()) return ext;
    if (ext.error) errors.push(`[ocrspace] ${ext.error}`);
  }

  return {
    success: false,
    text: '',
    provider: 'none',
    error: errors.join(' | ') || 'Nenhum motor OCR disponível',
  };
}

export type { OcrInput, OcrResult, OcrProvider } from './types';
