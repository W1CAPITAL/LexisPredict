/**
 * Merge puro heurística + IA — sem 'use server' (síncrono).
 * Aplica flags Claude/OmniRoute sobre o patch do scanner.
 */
import type { AiCaseClassification } from '@/lib/ai/case-event-classifier';
import { sanitizeScanPatchNaoEncerrarCarteira } from '@/lib/protect-encerrar';
import { isTutelaLiminarNaoEncerramento } from '@/lib/nao-encerrar-tutela';

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

  // P0: A IA interpreta trechos, mas NÃO é prova de encerramento,
  // procedência, cumprimento ou busca e apreensão. Apenas os motores
  // oficiais/um operador podem alimentar essas colunas do CRM.
  // Guardar sugestões em namespace ai_* para revisão, preservando
  // qualquer flag oficial já calculada pelo DataJud/DJEN.
  const aiBlob = `${ai.evento_resumo || ''} ${ai.evento_tipo || ''} ${out.evento_resumo || ''} ${out.datajud_ultimo_nome || ''} ${out.djen_ultimo_resumo || ''}`;
  const onlyTutela = isTutelaLiminarNaoEncerramento(aiBlob) || ai.evento_tipo === 'liminar';
  if (f.encerrado && !onlyTutela) {
    out.ai_sugere_baixa = true;
    out.precisa_revisar_encerramento = true;
  }
  if (f.encerrado && onlyTutela) out.ai_sugere_liminar = true;
  if (f.cumprimento_sentenca) out.ai_sugere_cumprimento = true;
  if (f.procedente || f.improcedente || f.parcial) {
    out.ai_merito_sugerido = f.parcial ? 'parcial' : f.improcedente ? 'improcedente' : 'procedente';
  }
  if (f.busca_apreensao) {
    out.ai_sugere_busca_apreensao = true;
    out.ai_ba_tipo_sugerido = f.ba_tipo || null;
  }
  if (f.cancelamento_distribuicao) out.ai_sugere_cancelamento_distribuicao = true;
  if (f.liminar) out.ai_sugere_liminar = true;
  if (f.audiencia) out.ai_sugere_audiencia = true;
  if (f.custas) out.ai_sugere_custas = true;
  if (ai.severidade === 'critica' || ai.alertar || f.encerrado || f.cumprimento_sentenca ||
      f.busca_apreensao || f.procedente || f.improcedente || f.parcial) {
    out.alerta_ia = true;
    out.prioridade_critica_ia = ai.severidade === 'critica';
    out.scan_priority = Math.max(Number(out.scan_priority || 40),
      ai.severidade === 'critica' ? 85 : 60);
  }
  // Nunca substituir evento_tipo, evento_resumo, evento_fonte,
  // tem_novo_andamento ou as colunas judiciais pelo texto da IA.
  // A classificação continua em ai_evento_tipo/ai_evento_resumo.

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
  out.ai_log_line = `[HIPÓTESE IA: ${formatEngineLabel(ai.engine)} · NÃO CONFIRMADO] ${ai.evento_resumo || out.ai_flags_label}${
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
