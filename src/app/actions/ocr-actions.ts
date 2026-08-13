'use server';

import { runOcr } from '@/lib/ocr';

/**
 * OCR a partir de base64 (print do tribunal, PDF rasterizado, etc.)
 * Sem IA generativa.
 */
export async function ocrFromBase64Action(input: {
  base64: string;
  mimeType?: string;
  language?: string;
  prefer?: 'internal' | 'external' | 'auto';
}) {
  try {
    const raw = String(input.base64 || '');
    const cleaned = raw.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleaned, 'base64');
    if (!buffer.length) {
      return { success: false, text: '', provider: 'none', error: 'Imagem vazia' };
    }
    return await runOcr({
      buffer,
      mimeType: input.mimeType || 'image/png',
      language: input.language || 'por',
      prefer: input.prefer || 'auto',
    });
  } catch (e: any) {
    return {
      success: false,
      text: '',
      provider: 'none' as const,
      error: e?.message || 'Falha OCR',
    };
  }
}

/** Extrai CNJ do texto OCR (atalho operacional) */
export async function ocrExtractCnjAction(base64: string, mimeType?: string) {
  const res = await ocrFromBase64Action({ base64, mimeType, prefer: 'auto' });
  const text = res.text || '';
  const m = text.match(/\d{7}[-.]?\d{2}[.]?\d{4}[.]?\d[.]?\d{2}[.]?\d{4}/);
  return {
    ...res,
    cnj: m ? m[0] : null,
  };
}
