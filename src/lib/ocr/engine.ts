/**
 * Motor OCR Lexis — APENAS INTERNO / SELF-HOST.
 *
 * 1) PaddleOCR self-host (OCR_PADDLE_URL) — opcional
 * 2) Unlimited-OCR self-host (OCR_UNLIMITED_URL) — opcional
 * 3) Tesseract local (servidor) — fallback sem rede externa
 *
 * O bundle Next.js não carrega Paddle/Python/modelos. O sidecar é opcional.
 */
import type { OcrInput, OcrResult } from './types';
import { ocrPaddleInternal, isPaddleOcrConfigured } from './internal-paddle';
import { ocrUnlimitedInternal } from './internal-unlimited';
import { ocrTesseractInternal } from './internal-tesseract';
import { cleanDocumentText } from './internal-pipeline';

export async function runOcr(input: OcrInput): Promise<OcrResult> {
  const mime = input.mimeType || 'image/png';
  const lang = input.language || 'por';
  const errors: string[] = [];

  // 1) PaddleOCR self-host. Só chama quando configurado.
  if (input.prefer === 'paddle' || isPaddleOcrConfigured()) {
    const p = await ocrPaddleInternal(input.buffer, mime, lang);
    if (p.success && p.text.trim()) {
      return { ...p, text: cleanDocumentText(p.text) };
    }
    if (p.error) errors.push(`[paddle] ${p.error}`);
  }

  // 2) Unlimited-OCR self-host (opcional)
  const u = await ocrUnlimitedInternal(input.buffer, mime, lang);
  if (u.success && u.text.trim()) {
    return { ...u, text: cleanDocumentText(u.text) };
  }
  if (u.error) errors.push(`[unlimited] ${u.error}`);

  // 3) Tesseract interno
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
      'OCR interno indisponível. Configure OCR_PADDLE_URL/OCR_UNLIMITED_URL ou use Tesseract local.',
  };
}

export type { OcrInput, OcrResult, OcrProvider } from './types';
