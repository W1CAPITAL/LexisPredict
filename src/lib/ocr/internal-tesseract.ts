/**
 * OCR interno leve (sem API de IA) — tesseract.js já no package.json do Lexis.
 * Usado quando Unlimited-OCR self-host não está disponível.
 */
import type { OcrResult } from './types';

export async function ocrTesseractInternal(
  buffer: Buffer,
  language = 'por'
): Promise<OcrResult> {
  const started = Date.now();
  try {
    // import dinâmico — não quebra build se worker falhar em edge
    const Tesseract = await import('tesseract.js');
    const lang = language.startsWith('por') ? 'por' : language === 'eng' ? 'eng' : 'por+eng';
    const result = await Tesseract.recognize(buffer, lang, {
      logger: () => {},
    });
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
