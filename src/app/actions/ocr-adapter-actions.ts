'use server';

/**
 * OCR adapter — INTERNO ONLY.
 * Removido: OCR.space, LEXIS_OCR_ENDPOINT externo comercial.
 * NER determinístico permanece (sem LLM).
 */

import { extractLegalEntities, type LegalNerResult } from '@/lib/legal-ner';

/** Sempre indica motor local — não tenta externo. */
export async function ocrViaAdapterAction(_input: {
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
  return {
    success: false,
    text: '',
    engine: 'internal_only',
    latencyMs: 0,
    needLocal: true,
    error: 'Motor exclusivamente interno — use Tesseract local na aba OCR',
  };
}

/** NER puro sobre texto já obtido */
export async function legalNerFromTextAction(text: string) {
  const ner = extractLegalEntities(text || '');
  return { success: true as const, ner };
}

export async function ocrHealthAction() {
  return {
    externalConfigured: false,
    internalOnly: true,
    unlimitedUrl: !!(process.env.OCR_UNLIMITED_URL || '').trim(),
    endpointHost: null as string | null,
  };
}
