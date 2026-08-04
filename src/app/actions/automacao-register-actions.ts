/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * Cadastro Automação Judicial → carteira (Processos) + OCR print.
 * REGRA Next.js: neste arquivo só export async function (+ types/interfaces).
 */
'use server';

import {
  getStoredCasesForEmpresa,
  saveStoredCasesForEmpresa,
  getUserContext,
} from '@/lib/server-db';
import { processarCaso, type LegalCase } from '@/lib/case-logic';
import {
  digitsOnly,
  formatCnj,
  extractCnjFromText,
} from '@/lib/cnj-extract';

export interface AutomacaoCadastroInput {
  protocolo: string;
  cliente: string;
  telefone?: string;
  tribunal?: string;
  classificacao?: string;
  ofensor?: string;
  observacao?: string;
  textoTribunal?: string;
}

export async function registerCaseFromAutomacaoAction(
  input: AutomacaoCadastroInput
) {
  try {
    const ctx = await getUserContext();
    const empresa_id = ctx?.empresa_id;
    const user_id = (ctx as any)?.user_id ?? (ctx as any)?.userId ?? null;

    if (!empresa_id) {
      return { success: false as const, error: 'Sessão expirada.' };
    }

    const protocolo = formatCnj(input.protocolo);
    const dig = digitsOnly(protocolo);
    if (dig.length !== 20) {
      return { success: false as const, error: 'CNJ inválido (20 dígitos).' };
    }
    if (!input.cliente?.trim()) {
      return { success: false as const, error: 'Informe o nome do cliente.' };
    }

    const cases: LegalCase[] =
      (await getStoredCasesForEmpresa(empresa_id)) || [];
    const idx = cases.findIndex(
      (c) => digitsOnly(c.protocolo || '') === dig
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

    const base = {
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
        protocolo: base.protocolo,
        cliente: base.cliente,
        telefone: base.telefone,
        tribunal: base.tribunal,
        observacao: base.observacao,
        status: 'Sem Prazo',
        ...(user_id ? { created_by: user_id } : {}),
      } as LegalCase);
      next = [created, ...cases];
    }

    await saveStoredCasesForEmpresa(next, empresa_id);

    return {
      success: true as const,
      protocolo,
      created: idx < 0,
      message:
        idx >= 0
          ? 'Processo atualizado na carteira (aba Processos).'
          : 'Processo cadastrado na carteira (aba Processos).',
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Falha ao gravar na carteira.';
    console.error('[registerCaseFromAutomacao]', e);
    return { success: false as const, error: msg };
  }
}

export async function transcribeTribunalPrintAction(payload: {
  text?: string;
  imageBase64?: string;
  mimeType?: string;
}) {
  try {
    if (payload.text && payload.text.trim().length > 10) {
      const text = payload.text.trim();
      return {
        success: true as const,
        text,
        cnj: extractCnjFromText(text),
        engine: 'paste' as const,
      };
    }

    if (!payload.imageBase64) {
      return {
        success: false as const,
        error: 'Envie uma imagem (print) ou cole o texto do tribunal.',
      };
    }

    const mime = payload.mimeType || 'image/png';
    const b64 = payload.imageBase64.replace(/^data:[^;]+;base64,/, '');

    const gemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
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
                    text: 'Transcreva o texto legível deste print de processo judicial brasileiro. Extraia CNJ, partes, movimentações e datas. Responda só com o texto transcrito.',
                  },
                  { inline_data: { mime_type: mime, data: b64 } },
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
              ?.map((p: { text?: string }) => p.text)
              .filter(Boolean)
              .join('\n') || '';
          if (text.trim()) {
            return {
              success: true as const,
              text: text.trim(),
              cnj: extractCnjFromText(text),
              engine: 'gemini' as const,
            };
          }
        }
      } catch (e) {
        console.error('[OCR Gemini]', e);
      }
    }

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
                    image_url: { url: `data:${mime};base64,${b64}` },
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
              success: true as const,
              text: text.trim(),
              cnj: extractCnjFromText(text),
              engine: 'xai' as const,
            };
          }
        }
      } catch (e) {
        console.error('[OCR xAI]', e);
      }
    }

    return {
      success: false as const,
      error:
        'Não foi possível transcrever o print. Cole o texto ou configure GEMINI_API_KEY / XAI_API_KEY.',
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Falha na transcrição';
    return { success: false as const, error: msg };
  }
}
