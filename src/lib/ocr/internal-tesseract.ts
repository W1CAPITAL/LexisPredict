/**
 * OCR interno Tesseract (servidor). Sem API externa.
 * Em Vercel, createWorker no Node é instável — a aba /tools/ocr
 * roda Tesseract no browser com o mesmo pipeline interno.
 */
import type { OcrResult } from './types';

export async function ocrTesseractInternal(
  buffer: Buffer,
  language = 'por'
): Promise<OcrResult> {
  const started = Date.now();
  try {
    if (process.env.VERCEL === '1' && process.env.OCR_FORCE_TESSERACT !== '1') {
      return {
        success: false,
        text: '',
        provider: 'tesseract_internal',
        error:
          'No Vercel use a aba OCR (motor interno no browser). Server Tesseract opcional: OCR_FORCE_TESSERACT=1',
        latencyMs: Date.now() - started,
      };
    }

    const Tesseract = await import('tesseract.js');
    const lang = language.startsWith('por') ? 'por' : language === 'eng' ? 'eng' : 'por+eng';
    const result = await Tesseract.recognize(buffer, lang, { logger: () => {} });
    const text = String(result?.data?.text || '').trim();
    return {
      success: !!text,
      text,
      provider: 'tesseract_internal',
      error: text ? undefined : 'Tesseract não extraiu texto',
      latencyMs: Date.now() - started,
    };
  } catch (e: any) {
    return {
      success: false,
      text: '',
      provider: 'tesseract_internal',
      error: e?.message || 'Falha Tesseract interno',
      latencyMs: Date.now() - started,
    };
  }
}
