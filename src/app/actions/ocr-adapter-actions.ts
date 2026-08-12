'use server';

import { isExternalOcrConfigured, runExternalOcr } from '@/lib/ocr/external-ocr-adapter';
import { extractLegalEntities, type LegalNerResult } from '@/lib/legal-ner';

/**
 * Tenta OCR externo; se falhar, retorna needLocal=true para o cliente usar Tesseract.
 */
export async function ocrViaAdapterAction(input: {
  base64: string;
  filename?: string;
  mimeType?: string;
}): Promise<{
  success: boolean;
  text: string;
  engine: string;
  latencyMs: number;
  needLocal?: boolean;
  error?: string;
  ner?: LegalNerResult;
}> {
  if (!input?.base64) {
    return { success: false, text: '', engine: 'none', latencyMs: 0, error: 'Sem arquivo' };
  }

  if (!isExternalOcrConfigured()) {
    return {
      success: false,
      text: '',
      engine: 'none',
      latencyMs: 0,
      needLocal: true,
      error: 'OCR externo não configurado — use motor local (Tesseract)',
    };
  }

  const bytes = Buffer.from(input.base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
  const r = await runExternalOcr({
    bytes,
    filename: input.filename,
    mimeType: input.mimeType,
  });

  if (!r.ok || !r.text) {
    return {
      success: false,
      text: '',
      engine: r.engine,
      latencyMs: r.latencyMs,
      needLocal: true,
      error: r.error || 'OCR externo falhou',
    };
  }

  const ner = extractLegalEntities(r.text);
  return {
    success: true,
    text: r.text,
    engine: r.engine,
    latencyMs: r.latencyMs,
    ner,
  };
}

/** NER puro sobre texto já obtido (OCR local ou colado) */
export async function legalNerFromTextAction(text: string) {
  const ner = extractLegalEntities(text || '');
  return { success: true as const, ner };
}

export async function ocrHealthAction() {
  return {
    externalConfigured: isExternalOcrConfigured(),
    endpointHost: (() => {
      try {
        const u = process.env.LEXIS_OCR_ENDPOINT || '';
        return u ? new URL(u).host : null;
      } catch {
        return null;
      }
    })(),
  };
}
