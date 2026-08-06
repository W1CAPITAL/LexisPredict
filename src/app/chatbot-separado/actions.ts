'use server';

import { chatAIFlow } from '@/ai/flows/chat-ai-flow';
import type { VisionImage } from '@/lib/ai/cascade';

export async function extractPdfTextForChatAction(formData: FormData) {
  try {
    const file = formData.get('pdf') as File | null;
    if (!file) return { success: false as const, error: 'Nenhum PDF' };
    const name = file.name || 'documento.pdf';
    if (!name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return { success: false as const, error: 'Arquivo deve ser PDF' };
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 12 * 1024 * 1024) {
      return { success: false as const, error: 'PDF maior que 12 MB' };
    }
    const { extractTextResilient } = await import('@/app/actions/knowledge-actions');
    const text = await extractTextResilient(buf, name);
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean || clean.length < 20) {
      return {
        success: false as const,
        error: 'Não foi possível extrair texto (PDF escaneado? use OCR na aba OCR).',
      };
    }
    return {
      success: true as const,
      text: clean.slice(0, 30000),
      name,
      chars: clean.length,
    };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha ao ler PDF' };
  }
}

export async function perguntarChatbotIndependente(
  prompt: string,
  history: Array<{ role: string; content: string }> = [],
  model: string = 'claude',
  opts?: {
    baClaudeDjen?: boolean;
    images?: VisionImage[];
    pdfText?: string;
    pdfName?: string;
    temperature?: number;
    max_tokens?: number;
  }
) {
  try {
    const res = await chatAIFlow({
      pergunta: prompt,
      historico: (history || [])
        .filter((h) => h.role === 'user' || h.role === 'assistant')
        .map((h) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
      preferred: model || 'claude',
      preferredModel: model || 'claude',
      baClaudeDjen: !!opts?.baClaudeDjen,
      images: opts?.images,
      pdfText: opts?.pdfText,
      pdfName: opts?.pdfName,
      temperature: opts?.temperature,
      max_tokens: opts?.max_tokens ?? 4096,
      showThinking: true,
    });

    return {
      sucesso: res.sucesso,
      resposta: res.resposta,
      thinking: res.thinking ?? null,
      engine: res.engineUtilizada,
      engineUtilizada: res.engineUtilizada,
      tokens: res.tokensConsumidos,
      latencia: res.latencia,
      baHint: res.baHint ?? null,
    };
  } catch (error: any) {
    return {
      sucesso: false,
      resposta: `Falha: ${error?.message || error}`,
      thinking: null,
      engine: 'ERROR',
      engineUtilizada: 'ERROR',
      tokens: 0,
      baHint: null,
    };
  }
}
