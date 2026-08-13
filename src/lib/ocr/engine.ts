/**
 * Motor OCR Lexis — APENAS INTERNO.
 *
 * 1) Unlimited-OCR self-host (OCR_UNLIMITED_URL) — modelo Baidu se você hospedar GPU
 * 2) Tesseract local (servidor) — sem rede externa
 *
 * Removido: OCR.space, qualquer endpoint LEXIS_OCR_* comercial, LLM.
 */
import type { OcrInput, OcrResult } from './types';
import { ocrUnlimitedInternal } from './internal-unlimited';
import { ocrTesseractInternal } from './internal-tesseract';
import { cleanDocumentText } from './internal-pipeline';

export async function runOcr(input: OcrInput): Promise<OcrResult> {
  const mime = input.mimeType || 'image/png';
  const lang = input.language || 'por';
  const errors: string[] = [];

  // 1) Self-host Unlimited-OCR (opcional)
  const u = await ocrUnlimitedInternal(input.buffer, mime, lang);
  if (u.success && u.text.trim()) {
    return { ...u, text: cleanDocumentText(u.text) };
  }
  if (u.error) errors.push(`[unlimited] ${u.error}`);

  // 2) Tesseract interno
  const t = await ocrTesseractInternal(input.buffer, lang);
  if (t.success && t.text.trim()) {
    return { ...t, text: cleanDocumentText(t.text) };
  }
  if (t.error) errors.push(`[tesseract] ${t.error}`);

  return {
    success: false,
    text: '',
    provider: 'none',
    error:
      errors.join(' | ') ||
      'OCR interno indisponível. No browser use a aba OCR (Tesseract local). Self-host: OCR_UNLIMITED_URL.',
  };
}

export type { OcrInput, OcrResult, OcrProvider } from './types';
