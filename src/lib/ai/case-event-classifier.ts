/**
 * Classificador neural de andamentos (DataJud + DJEN).
 * Principal: Claude via OmniRoute (runCascade).
 * Fallback: free gateway (Groq/Anthropic/OpenRouter/Pollinations).
 * Puter: ver case-event-classifier-puter.ts (browser).
 *
 * Detecta: cumprimento de sentença, encerrado/baixa/trânsito,
 * procedente / improcedente / parcial, liminar, BA, cancelamento, rotina.
 */
'use server';

import { runCascade } from '@/lib/ai/cascade';
import type { EventoTipo } from '@/lib/case-logic';

export type AiCaseClassification = {
  evento_tipo: EventoTipo | string;
  evento_resumo: string;
  severidade: 'critica' | 'alta' | 'media' | 'baixa' | 'positiva' | 'info';
  alertar: boolean;
  motivo_alerta: string | null;
  flags: {
    encerrado: boolean;
    cumprimento_sentenca: boolean;
    procedente: boolean;
    improcedente: boolean;
    parcial: boolean;
    liminar: boolean;
    busca_apreensao: boolean;
    cancelamento_distribuicao: boolean;
    novo_relevante: boolean;
  };
  engine: string;
  raw?: string;
};

const SYSTEM = `Você classifica andamentos processuais brasileiros (DataJud/DJEN) para um gabinete jurídico.
Responda APENAS JSON válido (sem markdown):
{
  "evento_tipo": "ba|audiencia_conciliacao|audiencia_instrucao|audiencia_julgamento|sentenca_procedente|sentenca_improcedente|sentenca_parcial|cumprimento_sentenca|transito_ou_baixa|cancelamento_distribuicao|liminar|novo_andamento_relevante|rotina",
  "evento_resumo": "frase curta em português",
  "severidade": "critica|alta|media|baixa|positiva|info",
  "alertar": true/false,
  "motivo_alerta": "string ou null",
  "flags": {
    "encerrado": bool,
    "cumprimento_sentenca": bool,
    "procedente": bool,
    "improcedente": bool,
    "parcial": bool,
    "liminar": bool,
    "busca_apreensao": bool,
    "cancelamento_distribuicao": bool,
    "novo_relevante": bool
  }
}
Regras:
- cumprimento de sentença / execução / intimação para pagamento → cumprimento_sentenca, alertar true se novo.
- trânsito em julgado / baixa definitiva / arquivamento / extinção → transito_ou_baixa, encerrado true.
- sentença procedente / improcedente / parcial → respectivos tipos; procedente = severidade positiva.
- mandado de busca e apreensão de bem → ba, severidade critica, alertar true.
- cancelamento da distribuição (art. 290) → cancelamento_distribuicao.
- liminar / tutela → liminar.
- Não invente fatos fora do texto. Se incerto, rotina + alertar false.`;

function compactMovs(movimentos: any[], max = 12): string {
  return (movimentos || [])
    .slice(0, max)
    .map((m) => {
      const d = m.dataHora || m.data || m.data_movimento || '';
      const n = m.nome || m.descricao || m.complemento || m.texto || '';
      return `- ${d} ${String(n).slice(0, 220)}`;
    })
    .join('\n');
}

function compactDjen(comunicacoes: any[], max = 8): string {
  return (comunicacoes || [])
    .slice(0, max)
    .map((c) => {
      const d = c.data_disponibilizacao || c.data || '';
      const t = c.texto || c.conteudo || c.resumo || '';
      return `- ${d} ${String(t).slice(0, 280)}`;
    })
    .join('\n');
}

function parseJson(text: string): any | null {
  try {
    const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const a = clean.indexOf('{');
    const b = clean.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    return JSON.parse(clean.slice(a, b + 1));
  } catch {
    return null;
  }
}

const DEFAULT_FLAGS = {
  encerrado: false,
  cumprimento_sentenca: false,
  procedente: false,
  improcedente: false,
  parcial: false,
  liminar: false,
  busca_apreensao: false,
  cancelamento_distribuicao: false,
  novo_relevante: false,
};

/**
 * Classifica contexto DataJud + DJEN com Claude/OmniRoute (cascata).
 */
export async function classifyCaseEventsWithAi(input: {
  protocolo: string;
  cliente?: string;
  movimentos?: any[];
  comunicacoes?: any[];
  preferred?: string;
}): Promise<AiCaseClassification | null> {
  const movTxt = compactMovs(input.movimentos || []);
  const djenTxt = compactDjen(input.comunicacoes || []);
  if (!movTxt && !djenTxt) return null;

  const user = `Protocolo: ${input.protocolo}
Cliente: ${input.cliente || '—'}

DATAJUD (movimentos recentes):
${movTxt || '(vazio)'}

DJEN (publicações recentes):
${djenTxt || '(vazio)'}

Classifique o estado processual atual.`;

  try {
    const r = await runCascade({
      preferred: input.preferred || 'claude',
      forceEngineId: undefined,
      surface: 'audit',
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
      temperature: 0.1,
      max_tokens: 700,
    });
    const j = parseJson(r.text);
    if (!j || !j.evento_tipo) return null;

    const flags = { ...DEFAULT_FLAGS, ...(j.flags || {}) };
    // coerência mínima
    if (flags.procedente) j.evento_tipo = j.evento_tipo || 'sentenca_procedente';
    if (flags.improcedente) j.evento_tipo = j.evento_tipo || 'sentenca_improcedente';
    if (flags.parcial) j.evento_tipo = j.evento_tipo || 'sentenca_parcial';
    if (flags.cumprimento_sentenca) j.evento_tipo = j.evento_tipo || 'cumprimento_sentenca';
    if (flags.encerrado) j.evento_tipo = j.evento_tipo || 'transito_ou_baixa';
    if (flags.busca_apreensao) j.evento_tipo = 'ba';

    return {
      evento_tipo: String(j.evento_tipo || 'rotina'),
      evento_resumo: String(j.evento_resumo || '').slice(0, 400),
      severidade: j.severidade || 'info',
      alertar: !!j.alertar,
      motivo_alerta: j.motivo_alerta ? String(j.motivo_alerta).slice(0, 300) : null,
      flags,
      engine: `${r.engineId}:${r.model}`,
      raw: r.text.slice(0, 1000),
    };
  } catch (e) {
    console.error('[classifyCaseEventsWithAi]', (e as any)?.message || e);
    return null;
  }
}

/** Aplica classificação AI sobre patch heurístico do scanner (não apaga flags já true). */
export function mergeAiIntoScanPatch(
  patch: Record<string, any>,
  ai: AiCaseClassification | null
): Record<string, any> {
  if (!ai) return patch;
  const out = { ...patch };

  out.ai_evento_tipo = ai.evento_tipo;
  out.ai_evento_resumo = ai.evento_resumo;
  out.ai_severidade = ai.severidade;
  out.ai_engine = ai.engine;
  out.ai_classificado_em = new Date().toISOString();

  if (ai.flags.encerrado) {
    out.datajud_encerrado_tribunal = true;
    out.datajud_encerrado_motivo =
      out.datajud_encerrado_motivo || ai.evento_resumo || 'IA: encerrado/baixa';
  }
  if (ai.flags.cumprimento_sentenca) {
    out.em_cumprimento_sentenca = true;
    out.cumprimento_sentenca_motivo =
      out.cumprimento_sentenca_motivo || ai.evento_resumo || 'IA: cumprimento de sentença';
    out.cumprimento_sentenca_consultado_em = new Date().toISOString();
  }
  if (ai.flags.busca_apreensao) {
    out.indicio_busca_apreensao = true;
    out.busca_apreensao_motivo =
      out.busca_apreensao_motivo || ai.evento_resumo || 'IA: busca e apreensão';
    out.busca_apreensao_confianca = out.busca_apreensao_confianca ?? 0.85;
  }
  if (ai.flags.cancelamento_distribuicao) {
    out.evento_tipo = 'cancelamento_distribuicao';
  }

  // evento_tipo: AI sobrescreve se mais grave que rotina
  const rank: Record<string, number> = {
    ba: 100,
    cancelamento_distribuicao: 95,
    transito_ou_baixa: 90,
    transito_baixa: 90,
    cumprimento_sentenca: 80,
    sentenca_improcedente: 75,
    sentenca_procedente: 70,
    sentenca_parcial: 65,
    liminar: 60,
    audiencia_julgamento: 55,
    audiencia_instrucao: 50,
    audiencia_conciliacao: 45,
    novo_andamento_relevante: 40,
    rotina: 10,
  };
  const cur = String(out.evento_tipo || 'rotina');
  const next = String(ai.evento_tipo || 'rotina');
  if ((rank[next] ?? 0) >= (rank[cur] ?? 0)) {
    out.evento_tipo = next;
    out.evento_resumo = ai.evento_resumo || out.evento_resumo;
    out.evento_fonte = out.evento_fonte || 'ai_omniroute';
  }

  if (ai.alertar) {
    out.tem_novo_andamento = true;
    out.alerta_ia = true;
    out.alerta_ia_motivo = ai.motivo_alerta || ai.evento_resumo;
    // sobe prioridade de scan
    const p = Number(out.scan_priority || 40);
    if (ai.severidade === 'critica') out.scan_priority = Math.max(p, 100);
    else if (ai.severidade === 'alta') out.scan_priority = Math.max(p, 90);
    else if (ai.severidade === 'positiva') out.scan_priority = Math.max(p, 70);
    else out.scan_priority = Math.max(p, 75);
  }

  return out;
}
