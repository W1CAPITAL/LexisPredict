/**
 * OCR interno leve (sem API de IA) — tesseract.js.
 * Em produção Vercel/browser com CSP estrito, workers blob podem falhar;
 * o engine prioriza OCR.space nesses ambientes.
 */
import type { OcrResult } from './types';

export async function ocrTesseractInternal(
  buffer: Buffer,
  language = 'por'
): Promise<OcrResult> {
  const started = Date.now();
  try {
    // Evita worker em ambientes serverless (sem threads estáveis)
    if (process.env.VERCEL === '1' && process.env.OCR_FORCE_TESSERACT !== '1') {
      return {
        success: false,
        text: '',
        provider: 'tesseract_internal',
        error: 'Tesseract desativado no Vercel (worker/CSP). Use OCR_SPACE_API_KEY.',
        latencyMs: Date.now() - started,
      };
    }

    const Tesseract = await import('tesseract.js');
    const lang = language.startsWith('por') ? 'por' : language === 'eng' ? 'eng' : 'por+eng';

    // createWorker com workerBlobURL quando disponível reduz violação em alguns browsers
    const worker = await (Tesseract as any).createWorker(lang, 1, {
      logger: () => {},
      workerBlobURL: true,
    });
    try {
      const result = await worker.recognize(buffer);
      const text = String(result?.data?.text || '').trim();
      return {
        success: !!text,
        text,
        provider: 'tesseract_internal',
        error: text ? undefined : 'Tesseract não extraiu texto',
        latencyMs: Date.now() - started,
      };
    } finally {
      try {
        await worker.terminate();
      } catch {
        /* ignore */
      }
    }
  } catch (e: any) {
    const msg = String(e?.message || e || 'Falha Tesseract interno');
    const csp =
      msg.includes('Content Security Policy') ||
      msg.includes('worker-src') ||
      msg.includes('blob:');
    return {
      success: false,
      text: '',
      provider: 'tesseract_internal',
      error: csp
        ? 'CSP bloqueou worker do Tesseract. Configure OCR_SPACE_API_KEY ou libere worker-src blob:.'
        : msg,
      latencyMs: Date.now() - started,
    };
  }
}
