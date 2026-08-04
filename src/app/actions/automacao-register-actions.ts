/**
 * Cadastro direto na Automação Judicial → grava na carteira (Processos).
 * OCR/transcrição de print do tribunal → CNJ + texto.
 */
'use server';

import {
  getStoredCasesForEmpresa,
  saveStoredCasesForEmpresa,
  getUserContext,
} from '@/lib/server-db';
import { processarCaso, type LegalCase } from '@/lib/case-logic';

function digits(s: string) {
  return String(s || '').replace(/\D/g, '');
}

function formatCnj(raw: string): string {
  const d = digits(raw);
  if (d.length !== 20) return raw.trim();
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

/** Extrai CNJ de texto (OCR ou colagem) */
export function extractCnjFromText(text: string): string | null {
  const m = text.match(
    /\d{7}[-.]?\d{2}[.]?\d{4}[.]?\d[.]?\d{2}[.]?\d{4}/
  );
  if (!m) return null;
  const d = digits(m[0]);
  return d.length === 20 ? formatCnj(d) : null;
}

export interface AutomacaoCadastroInput {
  protocolo: string;
  cliente: string;
  telefone?: string;
  tribunal?: string;
  classificacao?: string;
  ofensor?: string;
  observacao?: string;
  /** Texto OCR / movimentações coladas */
  textoTribunal?: string;
}

/**
 * Upsert na carteira da empresa (mesmo store dos Processos).
 */
export async function registerCaseFromAutomacaoAction(
  input: AutomacaoCadastroInput
) {
  try {
    const { empresa_id, user_id } = await getUserContext();
    if (!empresa_id) {
      return { success: false, error: 'Sessão expirada.' };
    }

    const protocolo = formatCnj(input.protocolo);
    const dig = digits(protocolo);
    if (dig.length !== 20) {
      return { success: false, error: 'CNJ inválido (20 dígitos).' };
    }
    if (!input.cliente?.trim()) {
      return { success: false, error: 'Informe o nome do cliente.' };
    }

    const cases = (await getStoredCasesForEmpresa(empresa_id)) || [];
    const idx = cases.findIndex(
      (c: LegalCase) => digits(c.protocolo) === dig
    );

    const obsParts = [
      input.observacao?.trim(),
      input.classificacao
        ? `Classificação: ${input.classificacao.trim()}`
        : '',
      input.ofensor ? `Ofensor: ${input.ofensor.trim()}` : '',
      input.textoTribunal
        ? `Trecho tribunal:\n${input.textoTribunal.trim().slice(0, 2000)}`
        : '',
    ].filter(Boolean);

    const base: Partial<LegalCase> = {
      protocolo,
      cliente: input.cliente.trim().toUpperCase(),
      telefone: input.telefone?.trim() || '',
      tribunal: input.tribunal?.trim() || '',
      observacao: obsParts.join('\n\n'),
    };

    let next: LegalCase[];
    if (idx >= 0) {
      const merged = processarCaso({
        ...cases[idx],
        ...base,
      } as LegalCase);
      next = [...cases];
      next[idx] = merged;
    } else {
      const created = processarCaso({
        id: `auto-${dig}-${Date.now()}`,
        protocolo,
        cliente: base.cliente!,
        telefone: base.telefone || '',
        tribunal: base.tribunal || '',
        observacao: base.observacao || '',
        status: 'Sem Prazo',
        created_by: user_id || undefined,
      } as LegalCase);
      next = [created, ...cases];
    }

    await saveStoredCasesForEmpresa(next, empresa_id);

    return {
      success: true,
      protocolo,
      created: idx < 0,
      message:
        idx >= 0
          ? 'Processo atualizado na carteira (aba Processos).'
          : 'Processo cadastrado na carteira (aba Processos).',
    };
  } catch (e: any) {
    console.error('[registerCaseFromAutomacao]', e);
    return {
      success: false,
      error: e?.message || 'Falha ao gravar na carteira.',
    };
  }
}

/**
 * Transcrição de print/PDF: texto puro ou visão (Gemini/xAI se houver chave).
 * Aceita text/plain colado ou dataURL de imagem.
 */
export async function transcribeTribunalPrintAction(payload: {
  text?: string;
  imageBase64?: string;
  mimeType?: string;
}) {
  try {
    // 1) Texto já OCR no cliente ou colado
    if (payload.text && payload.text.trim().length > 10) {
      const text = payload.text.trim();
      return {
        success: true,
        text,
        cnj: extractCnjFromText(text),
        engine: 'paste',
      };
    }

    if (!payload.imageBase64) {
      return {
        success: false,
        error: 'Envie uma imagem (print) ou cole o texto do tribunal.',
      };
    }

    const mime = payload.mimeType || 'image/png';
    const b64 = payload.imageBase64.replace(/^data:[^;]+;base64,/, '');

    // 2) Gemini vision
    const gemini =
      process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (gemini) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gemini}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Transcreva o texto legível deste print de processo judicial brasileiro.
Extraia em especial: número CNJ, partes, movimentações, datas.
Responda só com o texto transcrito, sem comentários.`,
                  },
                  {
                    inline_data: { mime_type: mime, data: b64 },
                  },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(45000),
        });
        if (res.ok) {
          const data = await res.json();
          const text =
            data?.candidates?.[0]?.content?.parts
              ?.map((p: any) => p.text)
              .filter(Boolean)
              .join('\n') || '';
          if (text.trim()) {
            return {
              success: true,
              text: text.trim(),
              cnj: extractCnjFromText(text),
              engine: 'gemini',
            };
          }
        }
      } catch (e) {
        console.error('[OCR Gemini]', e);
      }
    }

    // 3) xAI vision (se disponível)
    const xai =
      process.env.XAI_API_KEY ||
      process.env.XAI_GROK_PRESTIGE_API_KEY ||
      process.env.XAI_DOCUMENTS_API_KEY;
    if (xai) {
      try {
        const res = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${xai}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'grok-2-vision-1212',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Transcreva o texto deste print de processo judicial (CNJ, partes, movimentos). Só o texto.',
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${mime};base64,${b64}`,
                    },
                  },
                ],
              },
            ],
            max_tokens: 2048,
          }),
          signal: AbortSignal.timeout(45000),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data?.choices?.[0]?.message?.content || '';
          if (text.trim()) {
            return {
              success: true,
              text: text.trim(),
              cnj: extractCnjFromText(text),
              engine: 'xai',
            };
          }
        }
      } catch (e) {
        console.error('[OCR xAI]', e);
      }
    }

    return {
      success: false,
      error:
        'Não foi possível transcrever o print. Cole o texto manualmente ou configure GEMINI_API_KEY / XAI_API_KEY. Também pode usar a aba Motor de OCR.',
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Falha na transcrição' };
  }
}
