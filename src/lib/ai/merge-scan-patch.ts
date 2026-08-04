/**
 * Merge puro heurística + IA — sem 'use server' (síncrono).
 */
import type { AiCaseClassification } from '@/lib/ai/case-event-classifier';

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
  // BA só se a IA marcou explicitamente — heurística + confirmação estrita ficam no detector
  if (ai.flags.busca_apreensao) {
    out.indicio_busca_apreensao = true;
    out.busca_apreensao_motivo =
      out.busca_apreensao_motivo || ai.evento_resumo || 'IA: busca e apreensão';
    out.busca_apreensao_confianca = out.busca_apreensao_confianca ?? 0.85;
  }
  if (ai.flags.cancelamento_distribuicao) {
    out.evento_tipo = 'cancelamento_distribuicao';
  }

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
    out.evento_fonte = out.evento_fonte || 'ai';
  }

  if (ai.alertar) {
    out.tem_novo_andamento = true;
    out.alerta_ia = true;
    out.alerta_ia_motivo = ai.motivo_alerta || ai.evento_resumo;
    const p = Number(out.scan_priority || 40);
    if (ai.severidade === 'critica') out.scan_priority = Math.max(p, 100);
    else if (ai.severidade === 'alta') out.scan_priority = Math.max(p, 90);
    else if (ai.severidade === 'positiva') out.scan_priority = Math.max(p, 70);
    else out.scan_priority = Math.max(p, 75);
  }

  return out;
}
