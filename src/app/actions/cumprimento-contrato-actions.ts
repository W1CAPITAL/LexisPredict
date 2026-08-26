'use server';

/**
 * Upload de contrato para triagem de cumprimento — reutiliza OCR / extractTextResilient.
 */
import { extractTextResilient } from '@/app/actions/knowledge-actions';
import { runOcr } from '@/lib/ocr';
import { extrairCamposContrato, contratoTemCamposMinimos } from '@/lib/contrato-financiamento-extract';

export async function analisarContratoCumprimentoAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  textLen?: number;
  textPreview?: string;
  campos?: ReturnType<typeof extrairCamposContrato>;
  camposMinimos?: boolean;
  provider?: string;
}> {
  try {
    const file = formData.get('file') as File | null;
    if (!file || !file.size) {
      return { success: false, error: 'Arquivo vazio.' };
    }
    if (file.size > 12 * 1024 * 1024) {
      return { success: false, error: 'Arquivo acima de 12MB.' };
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const name = file.name || 'contrato.pdf';
    const mime = file.type || 'application/pdf';
    let text = '';
    let provider = 'pdf-text';

    try {
      text = await extractTextResilient(buf, name);
    } catch {
      provider = 'ocr';
      const ocr = await runOcr({
        buffer: buf,
        mimeType: mime.startsWith('image/') ? mime : 'application/pdf',
        language: 'por',
        prefer: 'internal',
      });
      text = ocr.text || '';
      if (!text.trim()) {
        return {
          success: false,
          error:
            ocr.error ||
            'Não foi possível extrair texto (PDF sem camada de texto / OCR falhou). Converta ou use a aba OCR.',
          provider,
        };
      }
    }

    const campos = extrairCamposContrato(text);
    return {
      success: true,
      textLen: text.length,
      textPreview: text.slice(0, 600),
      campos,
      camposMinimos: contratoTemCamposMinimos(campos),
      provider,
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha na análise do contrato.' };
  }
}
