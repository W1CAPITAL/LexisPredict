/**
 * Sincronia IA + DataJud + DJEN — E1.
 * Consulta o CNJ nas duas fontes oficiais, roda a camada de IA (cascade) com
 * fallback determinístico, gera minuta de peça e salva na carteira quando pedido.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved.
 */
'use server';

import {
  getUserContext,
  getStoredCasesForEmpresa,
  saveStoredCasesForEmpresa,
  getProfileByAuthId,
} from '@/lib/server-db';
import { processarCaso, type LegalCase } from '@/lib/case-logic';
import { digitsOnly, formatCnj } from '@/lib/cnj-extract';
import { fetchDataJud } from '@/lib/datajud';
import { fetchDjenComunicacoes, plainTextFromDjen } from '@/lib/djen';
import { runCascade } from '@/lib/ai/cascade';
import {
  detectarEventoIA,
  detectarProximoPrazoIA,
  ultimoMovimentoDataJud,
  polosDeterministicos,
  documentosDetectados,
  buildPecaIA,
  sanitizeProximoPrazo,
  type SincroniaMeta,
  type PecaIAInput,
  PECA_LABELS,
} from '@/lib/ia-engine';
import { enrichCadastroByCnjAction } from './automacao-register-actions';

const IA_SYSTEM_PROMPT = `Voce e o Motor Sincronia IA Elite (E1) da LexisPredict.
Receba dados reais de um processo judicial brasileiro do DataJud (CNJ) e DJEN (diario oficial).
Devolva APENAS JSON valido, sem markdown, neste formato exato:
{"cliente":"nome polo ativo PF ou ''","parte_passiva":"reu/banco ou ''","parte_passiva_cnpj":"cnpj 14 digitos ou ''","advogado":"advogado do autor ou ''","classe_acao":"classe ou ''","orgao_julgador":"orgao ou ''","cpf":"11 digitos ou ''","email":"email ou ''","telefone":"telefone ou ''","proximoPrazo":"YYYY-MM-DD mais proxima de prazo/audiencia OU null","risco":"Critico | Atencao | Normal","resumo":"resumo objetivo do andamento mais recente","sugestao":"1-2 linhas de orientacao","pecaSugerida":"informacoes | juntada | urgente | atualizacao"}
Regras: NUNCA invente dados ausentes (use '' ou null). Preserve numeros exatos.`;

function cleanJsonIA(text: string): any {
  if (!text) return null;
  try {
    const clean = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
    const a = clean.indexOf('{');
    const b = clean.lastIndexOf('}');
    if (a !== -1 && b > a) {
      const parsed = JSON.parse(clean.substring(a, b + 1));
      if (parsed && typeof parsed === 'object') return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function carregarFontes(protocolo: string) {
  let dj: any = null;
  try {
    dj = await fetchDataJud(protocolo, 1, { fast: false });
  } catch {
    dj = null;
  }
  let comunicacoes: any[] = [];
  let djenError = '';
  try {
    const r = await fetchDjenComunicacoes(protocolo, {
      dataInicio: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dataFim: new Date().toISOString().split('T')[0],
    });
    if (r?.success && Array.isArray(r.items)) comunicacoes = r.items;
    else djenError = r?.error || 'Sem publicações no DJEN.';
  } catch (e: any) {
    djenError = e?.message || 'Falha DJEN.';
  }
  const movimentos = Array.isArray(dj?.movimentos)
    ? dj.movimentos.map((m: any) => ({ ...m, fonte: 'datajud' }))
    : [];
  const comunicacoesMapped = comunicacoes.map((item: any) => ({
    ...item,
    textoPlain: plainTextFromDjen(String(item.texto || '')),
  }));
  return { dj, movimentos, comunicacoes, comunicacoesMapped, djenError };
}

function montarContexto(protocolo: string, dj: any, movimentos: any[], comunicacoesMapped: any[]) {
  const ult = ultimoMovimentoDataJud(movimentos);
  const polos = polosDeterministicos(dj, comunicacoesMapped);
  const docs = documentosDetectados(dj, comunicacoesMapped);
  const movs = [...movimentos]
    .sort((a: any, b: any) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime())
    .slice(0, 15)
    .map((m: any) => `- ${m.dataHora ? String(m.dataHora).slice(0, 10) : 'S/D'}: ${m.nome || 'Mov.'} ${m.complemento ? '— ' + m.complemento : ''}`)
    .join('\n');
  const coms = comunicacoesMapped
    .sort((a: any, b: any) => new Date(b.data_disponibilizacao || 0).getTime() - new Date(a.data_disponibilizacao || 0).getTime())
    .slice(0, 8)
    .map((c: any) => `- ${c.data_disponibilizacao ? String(c.data_disponibilizacao).slice(0, 10) : 'S/D'}: ${String(c.textoPlain || '').replace(/\s+/g, ' ').trim().slice(0, 400)}`)
    .join('\n');
  return `
NUMERO: ${protocolo}
CLASSE: ${dj?.classe || dj?.classeProcessual || 'N/D'}
ORGAO: ${dj?.orgaoJulgador || 'N/D'}
POLO ATIVO (heuristica): ${polos.cliente || 'N/D'}
POLO PASSIVO (heuristica): ${polos.parte_passiva || 'N/D'}
CPF/CNPJ detectados: CPF ${docs.cpf || '—'} | CNPJ ${docs.parte_passiva_cnpj || '—'}
ULTIMO MOVIMENTO: ${ult ? `${ult.data} — ${ult.nome} ${ult.complemento}` : 'N/D'}

MOVIMENTOS DATAJUD (recentes):
${movs || 'Nenhum movimento.'}

PUBLICACOES DJEN (recentes):
${coms || 'Nenhuma publicacao.'}
`.trim();
}

function aplicarIAEmMeta(meta: SincroniaMeta, ia: any): SincroniaMeta {
  const s = (v: any) => (typeof v === 'string' ? v.trim() : '');
  const np = (v: string) => s(v).toUpperCase().replace(/\s+/g, ' ').slice(0, 120);
  return {
    ...meta,
    cliente: meta.cliente || np(ia.cliente) || undefined,
    parte_passiva: meta.parte_passiva || np(ia.parte_passiva) || undefined,
    parte_passiva_cnpj: meta.parte_passiva_cnpj || s(ia.parte_passiva_cnpj) || undefined,
    advogado: meta.advogado || np(ia.advogado) || undefined,
    classe_acao: meta.classe_acao || np(ia.classe_acao) || undefined,
    orgao_julgador: meta.orgao_julgador || np(ia.orgao_julgador) || undefined,
    cpf: meta.cpf || s(ia.cpf) || undefined,
    email: meta.email || s(ia.email).toLowerCase() || undefined,
    telefone: meta.telefone || s(ia.telefone) || undefined,
    proximoPrazo: sanitizeProximoPrazo(meta.proximoPrazo || ia.proximoPrazo),
    risco: ['Crítico', 'Atenção', 'Normal'].includes(ia.risco) ? ia.risco : meta.risco,
    resumo: meta.resumo || s(ia.resumo) || undefined,
    sugestao: meta.sugestao || s(ia.sugestao) || undefined,
    pecaSugerida: ['informacoes', 'juntada', 'urgente', 'atualizacao'].includes(ia.pecaSugerida)
      ? ia.pecaSugerida
      : meta.pecaSugerida,
    fonte: 'IA+DataJud+DJEN',
  };
}

export async function sincronizarCasoIACompletoAction(input: {
  cnj: string;
  cliente?: string;
  salvarCarteira?: boolean;
}) {
  const protocolo = formatCnj(input?.cnj || '');
  const dig = digitsOnly(protocolo);
  if (dig.length !== 20) {
    return { success: false as const, error: 'CNJ inválido (20 dígitos).' };
  }

  try {
    const ctx = await getUserContext();
    const empresa_id = ctx?.empresa_id;
    const auth_id = (ctx as any)?.auth_id || (ctx as any)?.user_id || null;

    const { dj, movimentos, comunicacoesMapped, djenError } = await carregarFontes(protocolo);

    if (!dj && !comunicacoesMapped.length) {
      return {
        success: false as const,
        error: djenError || 'DataJud e DJEN sem dados para este CNJ. Confira o número.',
      };
    }

    let enrich: Awaited<ReturnType<typeof enrichCadastroByCnjAction>> | null = null;
    try {
      enrich = await enrichCadastroByCnjAction(protocolo);
    } catch {
      enrich = null;
    }

    const polos = polosDeterministicos(dj, comunicacoesMapped);
    const docs = documentosDetectados(dj, comunicacoesMapped);
    const evento = detectarEventoIA(movimentos, comunicacoesMapped);
    const prazo = detectarProximoPrazoIA(comunicacoesMapped);
    const ult = ultimoMovimentoDataJud(movimentos);

    let meta: SincroniaMeta = {
      protocolo,
      cliente: enrich?.cliente || input?.cliente?.trim().toUpperCase() || polos.cliente || undefined,
      parte_passiva: enrich?.parte_passiva || polos.parte_passiva || undefined,
      parte_passiva_cnpj: enrich?.parte_passiva_cnpj || docs.parte_passiva_cnpj || undefined,
      advogado: enrich?.advogado || undefined,
      advogado_passivo: enrich?.advogado_passivo || undefined,
      classe_acao: enrich?.classe_acao || undefined,
      tribunal: enrich?.tribunal || undefined,
      orgao_julgador: enrich?.orgao_julgador || undefined,
      cpf: enrich?.cpf || docs.cpf || undefined,
      email: enrich?.email || undefined,
      telefone: enrich?.telefone || undefined,
      dataDistribuicao: enrich?.dataAjuizamento || undefined,
      ultimoMovimento: ult?.data ? String(ult.data).slice(0, 10) : null,
      ultimaMovimentacao: ult ? `${ult.nome} ${ult.complemento}`.trim().slice(0, 220) : null,
      proximoPrazo: sanitizeProximoPrazo(prazo),
      resumo: evento.evento_resumo,
      risco: prazo ? 'Atenção' : 'Normal',
      sugestao: null,
      pecaSugerida: undefined,
      fonte: enrich?.fonte || 'DataJud+DJEN',
    };

    let engineUsed = 'deterministico';
    try {
      const context = montarContexto(protocolo, dj, movimentos, comunicacoesMapped);
      const iaRaw = await runCascade({
        preferred: 'xai',
        system: IA_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: context }],
        temperature: 0.1,
        max_tokens: 1600,
        surface: 'ia-sync',
      });
      const ia = cleanJsonIA(iaRaw?.text || '');
      if (ia && typeof ia === 'object') {
        meta = aplicarIAEmMeta(meta, ia);
        engineUsed = `${String(iaRaw?.engineId || 'ia').toUpperCase()}@${String(iaRaw?.model || '')}`;
      }
    } catch {
      // segue com o esqueleto determinístico
    }

    const eventoFinal = detectarEventoIA(movimentos, comunicacoesMapped);
    const resumoIA = meta.resumo || eventoFinal.evento_resumo;

    let salvo = false;
    let mensagemSalvar = '';
    if (input?.salvarCarteira && empresa_id) {
      try {
        const cases: LegalCase[] = (await getStoredCasesForEmpresa(empresa_id)) || [];
        const idx = cases.findIndex((c) => digitsOnly(c.protocolo || '') === dig);
        const agora = new Date().toISOString();
        let editorName = '';
        if (auth_id) {
          const prof = await getProfileByAuthId(String(auth_id)).catch(() => null);
          editorName = prof?.nome || '';
        }
        const base: Record<string, any> = {
          protocolo,
          cliente: meta.cliente || 'NÃO IDENTIFICADO',
          telefone: meta.telefone || '',
          tribunal: meta.tribunal || '',
          cpf: (meta.cpf || '').replace(/\D/g, ''),
          email: (meta.email || '').toLowerCase(),
          parte_passiva: meta.parte_passiva || '',
          parte_passiva_cnpj: (meta.parte_passiva_cnpj || '').replace(/\D/g, ''),
          classe_acao: meta.classe_acao || '',
          orgao_julgador: meta.orgao_julgador || '',
          advogado: meta.advogado || 'NÃO ATRIBUÍDO',
          advogado_passivo: meta.advogado_passivo || '',
          situacao: 'EM ANDAMENTO',
          proximoPrazo: meta.proximoPrazo || '',
          ultimoRetorno: meta.ultimoMovimento || '',
          evento_tipo: eventoFinal.evento_tipo === 'rotina' ? 'novo_andamento_relevante' : eventoFinal.evento_tipo,
          evento_resumo: resumoIA,
          evento_data: eventoFinal.evento_data,
          evento_fonte: eventoFinal.evento_fonte,
          tem_novo_andamento: true,
          datajud_ultimo_movimento: meta.ultimoMovimento,
          datajud_ultimo_nome: meta.ultimaMovimentacao,
          datajud_consultado_em: agora,
          djen_consultado_em: agora,
          djen_ultima_data: comunicacoesMapped[0]?.data_disponibilizacao || null,
          djen_ultimo_resumo: resumoIA,
          djen_count: comunicacoesMapped.length || 0,
          edited_by: auth_id || undefined,
          edited_at: agora,
          edited_by_name: editorName || undefined,
        };
        let next: LegalCase[];
        if (idx >= 0) {
          const merged = processarCaso({ ...cases[idx], ...base } as LegalCase);
          next = [...cases];
          next[idx] = merged;
        } else {
          const created = processarCaso({
            id: `ia-${dig}-${Date.now()}`,
            ...base,
            status: 'Sem Prazo',
            statusManual: 'Automatico',
            ...(auth_id ? { created_by: auth_id } : {}),
          } as LegalCase);
          next = [created, ...cases];
        }
        await saveStoredCasesForEmpresa(next, empresa_id);
        salvo = true;
        mensagemSalvar = idx >= 0 ? 'Processo atualizado na carteira.' : 'Processo cadastrado na carteira.';
      } catch (e: any) {
        mensagemSalvar = `Falha ao salvar na carteira: ${e?.message || 'erro'}`;
      }
    }

    return {
      success: true as const,
      protocolo,
      meta,
      evento: eventoFinal,
      prazoDetectado: meta.proximoPrazo,
      movimentos: movimentos.slice(0, 30),
      comunicacoes: comunicacoesMapped.slice(0, 20),
      engineUsed,
      fonte: meta.fonte || 'DataJud+DJEN',
      salvo,
      mensagemSalvar,
      resumoIA,
    };
  } catch (e: any) {
    console.error('[sincronizarCasoIACompleto]', e);
    return { success: false as const, error: e?.message || 'Falha na sincronização.' };
  }
}

export async function gerarPecaIAction(input: {
  cnj: string;
  cliente?: string;
  tipoPeca: PecaIAInput['tipo'];
}) {
  const protocolo = formatCnj(input?.cnj || '');
  const dig = digitsOnly(protocolo);
  if (dig.length !== 20) {
    return { success: false as const, error: 'CNJ inválido (20 dígitos).' };
  }
  try {
    const ctx = await getUserContext();
    const empresa_id = ctx?.empresa_id;
    let stored: LegalCase | null = null;
    if (empresa_id) {
      const cases = (await getStoredCasesForEmpresa(empresa_id)) || [];
      stored = cases.find((c) => digitsOnly(c.protocolo || '') === dig) || null;
    }

    let meta: SincroniaMeta = {
      protocolo,
      cliente: stored?.cliente || input?.cliente?.trim().toUpperCase() || undefined,
      parte_passiva: stored?.parte_passiva || undefined,
      advogado: stored?.advogado || undefined,
      classe_acao: stored?.classe_acao || undefined,
      tribunal: stored?.tribunal || undefined,
      orgao_julgador: stored?.orgao_julgador || undefined,
      resumo: stored?.evento_resumo || stored?.ultimaMovimentacao || undefined,
    };

    if (!meta.cliente && !meta.parte_passiva) {
      const enrich = await enrichCadastroByCnjAction(protocolo).catch(() => null);
      if (enrich?.success) {
        meta.cliente = enrich.cliente || meta.cliente;
        meta.parte_passiva = enrich.parte_passiva || meta.parte_passiva;
        meta.advogado = enrich.advogado || meta.advogado;
        meta.classe_acao = enrich.classe_acao || meta.classe_acao;
        meta.tribunal = enrich.tribunal || meta.tribunal;
        meta.orgao_julgador = enrich.orgao_julgador || meta.orgao_julgador;
        meta.parte_passiva_cnpj = enrich.parte_passiva_cnpj || meta.parte_passiva_cnpj;
      }
    }

    const peca = buildPecaIA({
      tipo: input.tipoPeca || 'informacoes',
      protocolo,
      cliente: meta.cliente,
      parte_passiva: meta.parte_passiva,
      advogado: meta.advogado,
      classe_acao: meta.classe_acao,
      tribunal: meta.tribunal,
      orgao_julgador: meta.orgao_julgador,
      resumo: meta.resumo,
    });

    return {
      success: true as const,
      peca,
      tipo: input.tipoPeca || 'informacoes',
      tipoLabel: PECA_LABELS[input.tipoPeca || 'informacoes'],
      protocolo,
    };
  } catch (e: any) {
    console.error('[gerarPecaIA]', e);
    return { success: false as const, error: e?.message || 'Falha ao gerar peça.' };
  }
}
