/**
 * Motor OCR Lexis — prioridade:
 * 1) Unlimited-OCR interno (self-host GPU) — base Baidu Unlimited-OCR
 * 2) OCR.space externo (alternativa estável no Vercel; não é LLM)
 * 3) Tesseract interno (último recurso — workers podem ser bloqueados por CSP)
 *
 * NÃO usa Gemini / xAI / Claude / GPT para OCR.
 */
import type { OcrInput, OcrResult } from './types';
import { ocrUnlimitedInternal } from './internal-unlimited';
import { ocrTesseractInternal } from './internal-tesseract';
import { ocrSpaceExternal } from './external-ocrspace';

function hasOcrSpaceKey() {
  return !!(process.env.OCR_SPACE_API_KEY || '').trim();
}

/** Em Vercel/serverless, worker do tesseract costuma falhar — OCR.space primeiro após unlimited. */
function preferSpaceOverTesseract() {
  if (hasOcrSpaceKey()) return true;
  if (process.env.VERCEL === '1') return true;
  if (process.env.OCR_SKIP_TESSERACT === '1') return true;
  return false;
}

export async function runOcr(input: OcrInput): Promise<OcrResult> {
  const mime = input.mimeType || 'image/png';
  const lang = input.language || 'por';
  const prefer = input.prefer || 'auto';

  const errors: string[] = [];

  if (prefer === 'external') {
    const ext = await ocrSpaceExternal(input.buffer, mime, lang);
    if (ext.success && ext.text.trim()) return ext;
    errors.push(ext.error || 'ocrspace fail');
  }

  if (prefer !== 'external') {
    // 1) Unlimited self-host
    const u = await ocrUnlimitedInternal(input.buffer, mime, lang);
    if (u.success && u.text.trim()) return u;
    if (u.error) errors.push(`[unlimited] ${u.error}`);

    // 2) OCR.space (estável no browser/server sem worker blob)
    if (prefer !== 'internal' || preferSpaceOverTesseract()) {
      const ext = await ocrSpaceExternal(input.buffer, mime, lang);
      if (ext.success && ext.text.trim()) return ext;
      if (ext.error) errors.push(`[ocrspace] ${ext.error}`);
    }

    // 3) Tesseract (pode falhar por CSP worker-src no browser)
    if (!preferSpaceOverTesseract() || prefer === 'internal') {
      const t = await ocrTesseractInternal(input.buffer, lang);
      if (t.success && t.text.trim()) return t;
      if (t.error) errors.push(`[tesseract] ${t.error}`);
    }
  }

  // Última tentativa: ocrspace se ainda não tentou
  if (prefer === 'internal' && hasOcrSpaceKey()) {
    const ext = await ocrSpaceExternal(input.buffer, mime, lang);
    if (ext.success && ext.text.trim()) return ext;
    if (ext.error) errors.push(`[ocrspace] ${ext.error}`);
  }

  return {
    success: false,
    text: '',
    provider: 'none',
    error: errors.join(' | ') || 'Nenhum motor OCR disponível. Configure OCR_SPACE_API_KEY no Vercel ou OCR_UNLIMITED_URL.',
  };
}

export type { OcrInput, OcrResult, OcrProvider } from './types';
