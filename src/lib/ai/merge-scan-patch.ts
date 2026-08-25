/**
 * Merge puro heurística + IA — sem 'use server' (síncrono).
 * Aplica flags Claude/OmniRoute sobre o patch do scanner.
 */
import type { AiCaseClassification } from '@/lib/ai/case-event-classifier';
import { sanitizeScanPatchNaoEncerrarCarteira } from '@/lib/protect-encerrar';

/** Aplica classificação AI sobre patch heurístico (não apaga flags já true). */
export function mergeAiIntoScanPatch(
  patch: Record<string, any>,
  ai: AiCaseClassification | null
): Record<string, any> {
  if (!ai) return patch;
  const out = { ...patch };
  const f = ai.flags || ({} as AiCaseClassification['flags']);

  out.ai_evento_tipo = ai.evento_tipo;
  out.ai_evento_resumo = ai.evento_resumo;
  out.ai_severidade = ai.severidade;
  out.ai_engine = ai.engine;
  out.ai_classificado_em = new Date().toISOString();
  out.ai_alertar = !!ai.alertar;
  out.ai_motivo_alerta = ai.motivo_alerta || null;

  // Encerrado / baixa — SOMENTE telemetria de tribunal (não grava situacao ENCERRADO)
  if (f.encerrado) {
    out.datajud_encerrado_tribunal = true;
    out.datajud_encerrado_motivo =
      out.datajud_encerrado_motivo || ai.evento_resumo || 'IA: encerrado/baixa';
    out.precisa_revisar_encerramento = true;
  }

  // Cumprimento de sentença
  if (f.cumprimento_sentenca) {
    out.em_cumprimento_sentenca = true;
    out.cumprimento_sentenca = true;
    out.cumprimento_sentenca_motivo =
      out.cumprimento_sentenca_motivo || ai.evento_resumo || 'IA: cumprimento de sentença';
    out.cumprimento_sentenca_consultado_em = new Date().toISOString();
  }

  // Mérito
  if (f.procedente) {
    out.sentenca_procedente = true;
    out.merito_resultado = 'procedente';
  }
  if (f.improcedente) {
    out.sentenca_improcedente = true;
    out.merito_resultado = out.merito_resultado || 'improcedente';
  }
  if (f.parcial) {
    out.sentenca_parcial = true;
    out.merito_resultado = 'parcial';
  }

  // Liminar / audiência / custas
  if (f.liminar) out.tem_liminar = true;
  if (f.audiencia) out.tem_audiencia = true;
  if (f.custas) {
    out.tem_custas = true;
    out.alerta_custas = true;
  }
  if (ai.severidade === 'critica' || ai.alertar) {
    out.prioridade_critica_ia = true;
    out.alerta_ia = true;
  }

  // BA
  if (f.busca_apreensao) {
    out.indicio_busca_apreensao = true;
    out.busca_apreensao_motivo =
      out.busca_apreensao_motivo || ai.evento_resumo || 'IA: busca e apreensão';
    out.busca_apreensao_confianca = out.busca_apreensao_confianca ?? 0.85;
    out.ba_tipo = f.ba_tipo || out.ba_tipo || 'GENERICO';
  }

  if (f.cancelamento_distribuicao) {
    out.cancelamento_distribuicao = true;
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
    audiencia: 55,
    audiencia_julgamento: 55,
    audiencia_instrucao: 50,
    audiencia_conciliacao: 45,
    custas: 42,
    novo_andamento_relevante: 40,
    rotina: 10,
  };

  const cur = String(out.evento_tipo || 'rotina');
  const next = String(ai.evento_tipo || 'rotina');
  if ((rank[next] ?? 0) >= (rank[cur] ?? 0)) {
    out.evento_tipo = next;
    out.evento_resumo = ai.evento_resumo || out.evento_resumo;
    out.evento_fonte = out.evento_fonte || 'ai_claude';
  }

  // Prioridade na fila crítica
  if (ai.alertar || f.novo_relevante || f.busca_apreensao || f.encerrado || f.cumprimento_sentenca) {
    out.tem_novo_andamento = true;
    out.alerta_ia = !!ai.alertar || f.novo_relevante || f.busca_apreensao;
    out.alerta_ia_motivo = ai.motivo_alerta || ai.evento_resumo;
    const p = Number(out.scan_priority || 40);
    if (ai.severidade === 'critica' || f.busca_apreensao) out.scan_priority = Math.max(p, 100);
    else if (ai.severidade === 'alta' || f.encerrado) out.scan_priority = Math.max(p, 90);
    else if (f.cumprimento_sentenca) out.scan_priority = Math.max(p, 80);
    else if (ai.severidade === 'positiva') out.scan_priority = Math.max(p, 70);
    else if (f.novo_relevante) out.scan_priority = Math.max(p, 75);
    else out.scan_priority = Math.max(p, 60);
  }

  // Texto legível para log do scanner
  const bits: string[] = [];
  if (f.busca_apreensao) bits.push(`BA${f.ba_tipo ? `:${f.ba_tipo}` : ''}`);
  if (f.encerrado) bits.push('ENCERRADO');
  if (f.cumprimento_sentenca) bits.push('CUMPRIMENTO');
  if (f.procedente) bits.push('PROCEDENTE');
  if (f.improcedente) bits.push('IMPROCEDENTE');
  if (f.parcial) bits.push('PARCIAL');
  if (f.liminar) bits.push('LIMINAR');
  if (f.audiencia) bits.push('AUDIÊNCIA');
  if (f.custas) bits.push('CUSTAS');
  if (f.novo_relevante) bits.push('RELEVANTE');
  if (ai.alertar) bits.push('ALERTA');
  out.ai_flags_label = bits.length ? bits.join(' · ') : 'rotina';
  out.ai_log_line = `[IA: ${formatEngineLabel(ai.engine)}] ${ai.evento_resumo || out.ai_flags_label}${
    bits.length ? ` | ${bits.join(' · ')}` : ''
  }`;

  return sanitizeScanPatchNaoEncerrarCarteira(out);
}

function formatEngineLabel(engine: string): string {
  const e = String(engine || '').toLowerCase();
  if (e.includes('omni') || e.includes('claude') || e.includes('anthropic')) {
    return 'Claude (OmniRoute)';
  }
  if (e.includes('groq')) return 'Groq Llama';
  if (e.includes('openrouter')) return 'OpenRouter';
  if (e.includes('xai') || e.includes('grok')) return 'xAI Grok';
  if (e.includes('gemini')) return 'Gemini';
  if (e.includes('puter')) return 'Puter';
  return engine || 'IA';
}

/** Lista curta de flags ativas para UI */
export function listAiFlagBadges(c: any): Array<{ key: string; label: string; tone: string }> {
  const out: Array<{ key: string; label: string; tone: string }> = [];
  if (c?.indicio_busca_apreensao)
    out.push({ key: 'ba', label: c.ba_tipo ? `B.A. ${c.ba_tipo}` : 'B.A.', tone: 'red' });
  if (c?.datajud_encerrado_tribunal) out.push({ key: 'enc', label: 'Encerrado', tone: 'black' });
  if (c?.em_cumprimento_sentenca || c?.cumprimento_sentenca)
    out.push({ key: 'cump', label: 'Cumprimento', tone: 'amber' });
  if (c?.sentenca_procedente || c?.merito_resultado === 'procedente')
    out.push({ key: 'proc', label: 'Procedente', tone: 'emerald' });
  if (c?.sentenca_improcedente || c?.merito_resultado === 'improcedente')
    out.push({ key: 'imp', label: 'Improcedente', tone: 'slate' });
  if (c?.sentenca_parcial || c?.merito_resultado === 'parcial')
    out.push({ key: 'par', label: 'Parcial', tone: 'blue' });
  if (c?.tem_liminar) out.push({ key: 'lim', label: 'Liminar', tone: 'violet' });
  if (c?.tem_audiencia) out.push({ key: 'aud', label: 'Audiência', tone: 'cyan' });
  if (c?.tem_custas) out.push({ key: 'cus', label: 'Custas', tone: 'orange' });
  if (c?.alerta_ia) out.push({ key: 'ai', label: 'Alerta IA', tone: 'red' });
  if (c?.ai_engine) out.push({ key: 'eng', label: String(c.ai_engine).split(':')[0], tone: 'muted' });
  return out;
}
