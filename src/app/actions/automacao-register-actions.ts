/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * Cadastro de processo → carteira + enriquecimento CNJ (DataJud + DJEN).
 * REGRA Next.js: neste arquivo só export async function (+ types/interfaces).
 */
'use server';

import {
  getStoredCasesForEmpresa,
  saveStoredCasesForEmpresa,
  getUserContext,
} from '@/lib/server-db';
import { processarCaso, type LegalCase, extrairTribunal } from '@/lib/case-logic';
import {
  digitsOnly,
  formatCnj,
  extractCnjFromText,
} from '@/lib/cnj-extract';
import { fetchDataJud, extrairPolos } from '@/lib/datajud';
import { fetchDjenComunicacoes, plainTextFromDjen } from '@/lib/djen';

export interface AutomacaoCadastroInput {
  protocolo: string;
  cliente: string;
  telefone?: string;
  tribunal?: string;
  classificacao?: string;
  ofensor?: string;
  observacao?: string;
  textoTribunal?: string;
  /** Campos estilo Astrea */
  cpf?: string;
  email?: string;
  estado_civil?: string;
  emprego?: string;
  nacionalidade?: string;
  parte_passiva?: string;
  parte_passiva_cnpj?: string;
  classe_acao?: string;
  orgao_julgador?: string;
  advogado?: string;
  escritorio?: string;
  proximoPrazo?: string;
  situacao?: string;
}

export interface CadastroEnrichResult {
  success: boolean;
  error?: string;
  protocolo?: string;
  cliente?: string;
  parte_passiva?: string;
  parte_passiva_cnpj?: string;
  advogado?: string;
  classe_acao?: string;
  tribunal?: string;
  orgao_julgador?: string;
  dataAjuizamento?: string | null;
  poloAtivo?: string[];
  poloPassivo?: string[];
  djenCount?: number;
  djenResumo?: string | null;
  movimentosResumo?: string | null;
  fonte?: string;
}

function pickAdvogadoFromPartes(partes: any[]): string {
  for (const p of partes || []) {
    const reps = p?.representantes || p?.advogados || p?.advogado || [];
    const list = Array.isArray(reps) ? reps : [reps];
    for (const r of list) {
      if (!r) continue;
      const nome = String(r?.nome || r?.nomeAdvogado || r || '').trim();
      if (nome && nome.length > 3) return nome.toUpperCase();
    }
    const tipo = String(p?.tipo || p?.tipoParte || '').toUpperCase();
    if (/ADVOGADO|OAB/.test(tipo)) {
      const nome = String(p?.nome || '').trim();
      if (nome) return nome.toUpperCase();
    }
  }
  return '';
}

function extractCnpjFromText(text: string): string | null {
  const m = text.match(
    /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/
  );
  if (!m) return null;
  const d = m[1].replace(/\D/g, '');
  return d.length === 14 ? d : null;
}

function extractPossibleBankName(text: string): string | null {
  const upper = text.toUpperCase();
  const banks = [
    'BANCO DO BRASIL',
    'BANCO ITAÚ',
    'BANCO ITAU',
    'ITAÚ UNIBANCO',
    'ITAU UNIBANCO',
    'BANCO BRADESCO',
    'BANCO SANTANDER',
    'CAIXA ECONÔMICA',
    'CAIXA ECONOMICA',
    'NUBANK',
    'BANCO INTER',
    'BANCO PAN',
    'BANCO BMG',
    'BANCO C6',
    'BANCO SAFRA',
    'BANCO ORIGINAL',
    'BANCO DAYCOVAL',
    'BANCO VOTORANTIM',
    'BANCO MERCANTIL',
    'CREFISA',
    'LOSANGO',
    'FINASA',
  ];
  for (const b of banks) {
    if (upper.includes(b)) return b;
  }
  return null;
}

/**
 * Enriquecimento por CNJ: DataJud (partes/classe) + DJEN (publicações).
 * Substitui o fluxo de screenshot automático do tribunal.
 */
export async function enrichCadastroByCnjAction(
  cnjInput: string
): Promise<CadastroEnrichResult> {
  try {
    const protocolo = formatCnj(cnjInput);
    const dig = digitsOnly(protocolo);
    if (dig.length !== 20) {
      return { success: false, error: 'CNJ inválido (20 dígitos).' };
    }

    const tribMeta = extrairTribunal(protocolo);
    const [dj, djen] = await Promise.all([
      fetchDataJud(protocolo, 1, { fast: false }),
      fetchDjenComunicacoes(protocolo, {
        siglaTribunal: tribMeta.tribunal !== 'Outros' ? tribMeta.tribunal : undefined,
      }),
    ]);

    let cliente = '';
    let parte_passiva = '';
    let parte_passiva_cnpj = '';
    let advogado = '';
    let classe_acao = '';
    let orgao_julgador = '';
    let tribunal = tribMeta.tribunal;
    let dataAjuizamento: string | null = null;
    let poloAtivo: string[] = [];
    let poloPassivo: string[] = [];
    let movimentosResumo: string | null = null;
    const fontes: string[] = [];

    if (dj && !dj.error) {
      fontes.push('DataJud');
      classe_acao = String(dj.classe || '').toUpperCase() || '';
      tribunal = String(dj.tribunal || tribunal).toUpperCase();
      orgao_julgador = String(dj.orgaoJulgador || '').toUpperCase() || '';
      dataAjuizamento = dj.dataAjuizamento || null;
      poloAtivo = Array.isArray(dj.poloAtivo) ? dj.poloAtivo : [];
      poloPassivo = Array.isArray(dj.poloPassivo) ? dj.poloPassivo : [];
      if (!poloAtivo.length && Array.isArray(dj.partes)) {
        const polos = extrairPolos(dj.partes);
        poloAtivo = polos.ativo;
        poloPassivo = polos.passivo;
      }
      cliente = poloAtivo[0] || '';
      parte_passiva = poloPassivo[0] || '';
      advogado = pickAdvogadoFromPartes(dj.partes || []);
      const movs = Array.isArray(dj.movimentos) ? dj.movimentos : [];
      if (movs.length) {
        const sorted = [...movs].sort(
          (a: any, b: any) =>
            new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
        );
        movimentosResumo = sorted
          .slice(0, 5)
          .map((m: any) => `${m.nome || m.descricao || 'Mov.'}`)
          .join(' · ');
      }
    }

    let djenResumo: string | null = null;
    let djenCount = 0;
    if (djen?.success && djen.items?.length) {
      fontes.push('DJEN');
      djenCount = djen.count || djen.items.length;
      const first = djen.items[0];
      djenResumo =
        first.nomeClasse ||
        first.tipoComunicacao ||
        (first.texto ? String(first.texto).slice(0, 160) : null);
      if (!classe_acao && first.nomeClasse) {
        classe_acao = String(first.nomeClasse).toUpperCase();
      }
      if (!tribunal || tribunal === 'OUTROS') {
        tribunal = String(first.siglaTribunal || tribunal).toUpperCase();
      }
      if (!orgao_julgador && first.nomeOrgao) {
        orgao_julgador = String(first.nomeOrgao).toUpperCase();
      }
      // Heurística de partes no texto das publicações
      const corpus = djen.items
        .slice(0, 8)
        .map((i) => plainTextFromDjen(i.texto || ''))
        .join('\n');
      if (!parte_passiva) {
        const bank = extractPossibleBankName(corpus);
        if (bank) parte_passiva = bank;
      }
      if (!parte_passiva_cnpj) {
        const cnpj = extractCnpjFromText(corpus);
        if (cnpj) parte_passiva_cnpj = cnpj;
      }
    }

    if (!fontes.length && dj?.error) {
      return {
        success: false,
        error: dj.message || djen?.error || 'Sem dados no DataJud/DJEN para este CNJ.',
        protocolo,
      };
    }

    return {
      success: true,
      protocolo,
      cliente: cliente ? cliente.toUpperCase() : '',
      parte_passiva: parte_passiva ? parte_passiva.toUpperCase() : '',
      parte_passiva_cnpj: parte_passiva_cnpj || '',
      advogado: advogado || '',
      classe_acao: classe_acao || '',
      tribunal: tribunal || tribMeta.tribunal,
      orgao_julgador: orgao_julgador || '',
      dataAjuizamento,
      poloAtivo,
      poloPassivo,
      djenCount,
      djenResumo,
      movimentosResumo,
      fonte: fontes.join('+') || 'CNJ',
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Falha no enriquecimento.';
    console.error('[enrichCadastroByCnj]', e);
    return { success: false, error: msg };
  }
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
      input.classe_acao ? `Classe/Ação: ${input.classe_acao.trim()}` : '',
      input.parte_passiva
        ? `Parte passiva: ${input.parte_passiva.trim()}${
            input.parte_passiva_cnpj
              ? ` (CNPJ ${input.parte_passiva_cnpj})`
              : ''
          }`
        : '',
      input.textoTribunal
        ? `Trecho tribunal:\n${input.textoTribunal.trim().slice(0, 2000)}`
        : '',
    ].filter(Boolean);

    const base: Record<string, any> = {
      protocolo,
      cliente: input.cliente.trim().toUpperCase(),
      telefone: input.telefone?.trim() || '',
      tribunal: input.tribunal?.trim() || '',
      observacao: obsParts.join('\n\n'),
      cpf: (input.cpf || '').replace(/\D/g, ''),
      email: (input.email || '').trim().toLowerCase(),
      estado_civil: (input.estado_civil || '').trim().toUpperCase(),
      emprego: (input.emprego || '').trim().toUpperCase(),
      nacionalidade: (input.nacionalidade || 'BRASILEIRA').trim().toUpperCase() || 'BRASILEIRA',
      parte_passiva: (input.parte_passiva || '').trim().toUpperCase(),
      parte_passiva_cnpj: (input.parte_passiva_cnpj || '').replace(/\D/g, ''),
      classe_acao: (input.classe_acao || input.classificacao || '').trim().toUpperCase(),
      orgao_julgador: (input.orgao_julgador || '').trim().toUpperCase(),
      advogado: (input.advogado || '').trim().toUpperCase(),
      escritorio: (input.escritorio || '').trim().toUpperCase(),
      proximoPrazo: input.proximoPrazo || '',
      situacao: (input.situacao || 'EM ANDAMENTO').toUpperCase(),
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
        id: `cad-${dig}-${Date.now()}`,
        ...base,
        status: 'Sem Prazo',
        statusManual: 'Automatico',
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
