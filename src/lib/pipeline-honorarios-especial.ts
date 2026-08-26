/**
 * LexisPredict — VERSÃO ESPECIAL (Lote 8)
 * Pipeline comercial de honorários / cumprimento.
 * Prioriza casos em que a banca tem honorários a receber, sem inventar R$.
 */

import type { LegalCase } from '@/lib/case-logic';
import { analisarHonorariosAReceber, type HonorariosReceberNivel } from '@/lib/honorarios-receber';
import { extrairCreditoSentenca } from '@/lib/credito-sentenca-extract';
import { reconciliarFlagsCumprimento } from '@/lib/reconciliar-cumprimento-flags';

export type EstagioEspecial =
  | 'triagem'
  | 'teor_ok'
  | 'hon_receber'
  | 'pronto_parceiro'
  | 'em_cumprimento'
  | 'bloqueado'
  | 'descartado';

export type RankingEspecial = {
  estagio: EstagioEspecial;
  prioridade: number; // 0–1000 (maior = primeiro)
  label: string;
  cor: string;
  honorariosNivel: HonorariosReceberNivel;
  scoreOportunidade: number;
  motivos: string[];
};

function blobDoCaso(c: LegalCase): string {
  const d = (c as any).dados && typeof (c as any).dados === 'object' ? (c as any).dados : {};
  return [
    (c as any).datajud_ultimo_nome,
    d.datajud_ultimo_nome,
    (c as any).djen_ultimo_resumo,
    d.djen_ultimo_resumo,
    (c as any).procedente_motivo,
    d.procedente_motivo,
    ...(Array.isArray(d.djen_textos) ? d.djen_textos : []),
    ...(Array.isArray(d.movimentos)
      ? d.movimentos.slice(0, 30).map((m: any) => `${m.nome || ''} ${m.complemento || ''}`)
      : []),
  ]
    .filter(Boolean)
    .join('\n');
}

function opOf(c: LegalCase) {
  const d = (c as any).dados && typeof (c as any).dados === 'object' ? (c as any).dados : {};
  return (
    (c as any).oportunidade_instaurar ||
    d.oportunidade_instaurar ||
    d.detalhes_execucao?.oportunidade_instaurar ||
    null
  );
}

/**
 * Classifica e ranqueia um caso para a esteira comercial de honorários.
 */
export function rankearCasoEspecial(c: LegalCase, limiar = 55): RankingEspecial {
  const d = (c as any).dados && typeof (c as any).dados === 'object' ? (c as any).dados : {};
  const flags = reconciliarFlagsCumprimento({
    cumprimento_pendente_necessario: c.cumprimento_pendente_necessario,
    em_cumprimento_sentenca: c.em_cumprimento_sentenca,
    cumprimento_ativo: (c as any).cumprimento_ativo,
    cumprimento_encerrado: (c as any).cumprimento_encerrado,
    status_executivo: (c as any).status_executivo || d.status_executivo,
    is_procedente: c.is_procedente,
    dados: d,
  });
  const blob = blobDoCaso(c);
  const hon = analisarHonorariosAReceber(blob, {
    isProcedente: !!c.is_procedente,
    meritoTipo: (c as any).merito_tipo || d.merito_tipo,
  });
  const credito = extrairCreditoSentenca(blob, {
    isProcedente: !!c.is_procedente,
    meritoTipo: (c as any).merito_tipo || d.merito_tipo,
  });
  const op = opOf(c);
  const score = Number((c as any).oportunidade_score ?? op?.score ?? 0);
  const elegivel = !!(c as any).oportunidade_elegivel || !!op?.elegivel;
  const teorOk = !!(c as any).teor_indice_ok || !!d.teor_indice_ok || !!d.teor_enriquecido_em;
  const textoPobre = !!(c as any).texto_pobre || !!d.texto_pobre || !!op?.texto_pobre;

  const motivos: string[] = [];
  let estagio: EstagioEspecial = 'triagem';
  let prioridade = 100;
  let label = 'Triagem';
  let cor = 'text-slate-600';

  if (hon.nivel === 'bloqueado' || credito.sucumbenciaReciproca) {
    return {
      estagio: 'bloqueado',
      prioridade: 5,
      label: 'Hon. bloqueados',
      cor: 'text-slate-500',
      honorariosNivel: 'bloqueado',
      scoreOportunidade: score,
      motivos: ['Sucumbência recíproca ou a cargo do autor'],
    };
  }

  if (flags.status_executivo === 'ativo' || flags.em_cumprimento_sentenca) {
    estagio = 'em_cumprimento';
    prioridade = 40;
    label = 'Já em cumprimento';
    cor = 'text-amber-700';
    motivos.push('Fase executiva já instaurada');
  } else if (
    hon.temHonorariosAReceber &&
    (hon.nivel === 'forte' || hon.nivel === 'medio') &&
    elegivel &&
    score >= limiar
  ) {
    estagio = 'pronto_parceiro';
    prioridade = 900 + Math.min(99, score);
    if (hon.nivel === 'forte') prioridade += 50;
    label = 'Pronto · empresa por fora';
    cor = 'text-violet-800';
    motivos.push('Honorários a receber + score ≥ limiar');
  } else if (hon.temHonorariosAReceber && hon.nivel !== 'bloqueado') {
    estagio = 'hon_receber';
    prioridade =
      hon.nivel === 'forte' ? 750 + hon.confianca : hon.nivel === 'medio' ? 600 + hon.confianca : 450;
    label =
      hon.nivel === 'forte'
        ? 'Honorários a receber · forte'
        : hon.nivel === 'medio'
          ? 'Honorários a receber · médio'
          : 'Possível honorários';
    cor = 'text-emerald-700';
    motivos.push(...hon.motivos.slice(0, 2));
  } else if (teorOk && !textoPobre && (c.is_procedente || flags.status_executivo === 'pendente')) {
    estagio = 'teor_ok';
    prioridade = 300 + Math.min(50, score);
    label = 'Teor ok · sem hon. claro';
    cor = 'text-blue-700';
    motivos.push('Índice ampliado; validar dispositivo de honorários');
  } else if (flags.status_executivo === 'pendente' || c.is_procedente) {
    estagio = 'triagem';
    prioridade = 200 + (textoPobre ? 0 : 30);
    label = textoPobre ? 'Triagem · teor fraco' : 'Triagem';
    cor = 'text-orange-700';
    motivos.push(textoPobre ? 'Enriquecer teor (Varrer cumprimento)' : 'Aguardando classificação');
  } else {
    estagio = 'descartado';
    prioridade = 10;
    label = 'Fora da esteira';
    cor = 'text-muted-foreground';
  }

  if (credito.art523) {
    prioridade += 15;
    motivos.push('Art. 523');
  }
  if (hon.percentual != null) {
    prioridade += 10;
    motivos.push(`${hon.percentual}% honorários`);
  }

  return {
    estagio,
    prioridade: Math.min(999, prioridade),
    label,
    cor,
    honorariosNivel: hon.nivel,
    scoreOportunidade: score,
    motivos: [...new Set(motivos)].slice(0, 5),
  };
}

export function ordenarFilaEspecial(cases: LegalCase[], limiar = 55): LegalCase[] {
  return [...cases].sort((a, b) => {
    const ra = rankearCasoEspecial(a, limiar);
    const rb = rankearCasoEspecial(b, limiar);
    return rb.prioridade - ra.prioridade;
  });
}

export type KpiEspecial = {
  prontoParceiro: number;
  honReceberForte: number;
  honReceberMedio: number;
  teorFraco: number;
  emCumprimento: number;
  bloqueados: number;
  topPrioridade: number;
};

export function kpiFilaEspecial(cases: LegalCase[], limiar = 55): KpiEspecial {
  let prontoParceiro = 0;
  let honReceberForte = 0;
  let honReceberMedio = 0;
  let teorFraco = 0;
  let emCumprimento = 0;
  let bloqueados = 0;
  let topPrioridade = 0;
  for (const c of cases) {
    const r = rankearCasoEspecial(c, limiar);
    if (r.prioridade > topPrioridade) topPrioridade = r.prioridade;
    if (r.estagio === 'pronto_parceiro') prontoParceiro++;
    if (r.estagio === 'hon_receber' && r.honorariosNivel === 'forte') honReceberForte++;
    if (r.estagio === 'hon_receber' && r.honorariosNivel === 'medio') honReceberMedio++;
    if (r.estagio === 'triagem' && r.label.includes('teor fraco')) teorFraco++;
    if (r.estagio === 'em_cumprimento') emCumprimento++;
    if (r.estagio === 'bloqueado') bloqueados++;
  }
  return {
    prontoParceiro,
    honReceberForte,
    honReceberMedio,
    teorFraco,
    emCumprimento,
    bloqueados,
    topPrioridade,
  };
}
