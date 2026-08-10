/**
 * Métricas do Dashboard + Índice de Risco Global explicável.
 */
import type { LegalCase } from './case-logic';
import { statusEfetivo, diasAtePrazo } from './prazo-status';
import { isCasoEncerrado } from './status-encerrado';
import { resolveTemNovoAndamento } from './novidade';
import {
  hasAudienciaPosRetorno,
  isSentencaImprocedente,
  isSentencaProcedente,
} from './merito-detect';

export type RiskFactor = {
  id: string;
  label: string;
  count: number;
  weight: number;
  contribution: number; // pontos no numerador (count * weight)
  meaning: string;
};

export type RiskExplanation = {
  score: number; // 0–100
  label: string;
  color: string;
  formula: string;
  summary: string;
  factors: RiskFactor[];
  recommendations: string[];
};

export function buildDashboardMetrics(cases: LegalCase[], labels?: {
  statusCritico?: string;
  statusHoje?: string;
  statusAtencao?: string;
  statusPrazo?: string;
  statusSemPrazo?: string;
}) {
  const t = {
    statusCritico: labels?.statusCritico || 'Crítico',
    statusHoje: labels?.statusHoje || 'É Hoje',
    statusAtencao: labels?.statusAtencao || 'Atenção',
    statusPrazo: labels?.statusPrazo || 'No Prazo',
    statusSemPrazo: labels?.statusSemPrazo || 'Sem Prazo',
  };

  const ativos = cases.filter((c) => !isCasoEncerrado(c));
  const activeTotal = ativos.length;

  const countVencido = ativos.filter((c) => {
    const s = statusEfetivo(c);
    return s === 'Vencido' || c.status === 'Caso Crítico' || c.statusManual === 'Caso Crítico';
  }).length;
  const countHoje = ativos.filter((c) => statusEfetivo(c) === 'É Hoje').length;
  const countAtencao = ativos.filter((c) => statusEfetivo(c) === 'Atenção').length;
  const countSaudavel = ativos.filter((c) => statusEfetivo(c) === 'No Prazo').length;
  const countSemPrazo = ativos.filter((c) => statusEfetivo(c) === 'Sem Prazo').length;

  const countNovoAndamento = ativos.filter((c) => resolveTemNovoAndamento(c)).length;
  const countEncerradoTribunal = ativos.filter((c) => !!c.datajud_encerrado_tribunal).length;
  const countCumprimento = ativos.filter((c) => !!c.em_cumprimento_sentenca).length;
  const countBA = ativos.filter((c) => !!(c as any).indicio_busca_apreensao).length;

  const countProcedente = ativos.filter((c) => isSentencaProcedente(c)).length;
  const countImprocedente = ativos.filter((c) => isSentencaImprocedente(c)).length;
  const countAudienciaPosRetorno = ativos.filter((c) => hasAudienciaPosRetorno(c)).length;

  const rateAndamento =
    activeTotal > 0 ? Math.round((countNovoAndamento / activeTotal) * 100) : 0;

  const risk = computeRiskIndex({
    activeTotal,
    countVencido,
    countHoje,
    countAtencao,
    countSaudavel,
    countSemPrazo,
    countImprocedente,
    countAudienciaPosRetorno,
    countBA,
    countNovoAndamento,
    countEncerradoTribunal,
  });

  const statusData = [
    { name: t.statusCritico, value: countVencido, color: '#ef4444' },
    { name: t.statusHoje, value: countHoje, color: '#3b82f6' },
    { name: t.statusAtencao, value: countAtencao, color: '#f97316' },
    { name: t.statusPrazo, value: countSaudavel, color: '#10b981' },
    { name: t.statusSemPrazo, value: countSemPrazo, color: '#94a3b8' },
  ].filter((d) => d.value > 0);

  return {
    activeTotal,
    countVencido,
    countHoje,
    countAtencao,
    countSaudavel,
    countSemPrazo,
    riskScore: risk.score,
    riskLabel: risk.label,
    riskColor: risk.color,
    riskExplanation: risk,
    statusData,
    countNovoAndamento,
    rateAndamento,
    countEncerradoTribunal,
    countBA,
    countCumprimento,
    countProcedente,
    countImprocedente,
    countAudienciaPosRetorno,
  };
}

/**
 * Índice de Risco Global (0–100)
 *
 * Significado: pressão operacional média da carteira ativa.
 * NÃO é probabilidade de perder a causa nem score jurídico de mérito.
 *
 * Fórmula:
 *   score = min(100, round( (Σ count_i × peso_i / N_ativos) × 100 ))
 *
 * Pesos (por processo naquela condição):
 *   Vencido/Crítico 1.00 | É hoje 0.80 | B.A. 0.90 | Atenção 0.50
 *   Improcedente 0.55 | Audiência pós-retorno 0.40 | Novo andamento 0.25
 *   Sem prazo 0.20 | No prazo 0.08 | Encerrado tribunal (ainda ativo no CRM) 0.15
 */
export function computeRiskIndex(input: {
  activeTotal: number;
  countVencido: number;
  countHoje: number;
  countAtencao: number;
  countSaudavel: number;
  countSemPrazo: number;
  countImprocedente: number;
  countAudienciaPosRetorno: number;
  countBA: number;
  countNovoAndamento: number;
  countEncerradoTribunal: number;
}): RiskExplanation {
  const N = input.activeTotal;

  const defs: Array<Omit<RiskFactor, 'contribution'> & { count: number }> = [
    {
      id: 'vencido',
      label: 'Vencidos / críticos',
      count: input.countVencido,
      weight: 1.0,
      meaning: 'Retorno ao cliente já passou do prazo interno — maior pressão de fila.',
    },
    {
      id: 'ba',
      label: 'Indício busca e apreensão',
      count: input.countBA,
      weight: 0.9,
      meaning: 'Risco operacional urgente (bem / liminar); exige contato prioritário.',
    },
    {
      id: 'hoje',
      label: 'Prazo é hoje',
      count: input.countHoje,
      weight: 0.8,
      meaning: 'Contato ou providência prevista para o dia corrente.',
    },
    {
      id: 'improcedente',
      label: 'Indício sentença improcedente',
      count: input.countImprocedente,
      weight: 0.55,
      meaning: 'Possível desfecho desfavorável — validar teor e orientação ao cliente.',
    },
    {
      id: 'atencao',
      label: 'Atenção (próximo do prazo)',
      count: input.countAtencao,
      weight: 0.5,
      meaning: 'Janela curta antes de virar vencido.',
    },
    {
      id: 'audiencia',
      label: 'Audiência após último retorno',
      count: input.countAudienciaPosRetorno,
      weight: 0.4,
      meaning: 'Cliente pode não ter sido avisado da audiência nova.',
    },
    {
      id: 'novidade',
      label: 'Novo andamento não tratado',
      count: input.countNovoAndamento,
      weight: 0.25,
      meaning: 'Há novidade DataJud/DJEN ainda sem registro de retorno.',
    },
    {
      id: 'sem_prazo',
      label: 'Sem prazo cadastrado',
      count: input.countSemPrazo,
      weight: 0.2,
      meaning: 'Falta de próximo retorno reduz controle da fila.',
    },
    {
      id: 'encerrado_tj',
      label: 'Encerrado no tribunal (ainda ativo no CRM)',
      count: input.countEncerradoTribunal,
      weight: 0.15,
      meaning: 'Baixa/trânsito detectado — conferir e eventualmente encerrar no Lexis.',
    },
    {
      id: 'no_prazo',
      label: 'No prazo',
      count: input.countSaudavel,
      weight: 0.08,
      meaning: 'Carteira saudável — peso residual de monitoramento.',
    },
  ];

  const factors: RiskFactor[] = defs.map((d) => ({
    ...d,
    contribution: d.count * d.weight,
  }));

  const riskSum = factors.reduce((s, f) => s + f.contribution, 0);
  const score = N > 0 ? Math.min(100, Math.round((riskSum / N) * 100)) : 0;

  let label = 'BAIXO';
  let color = 'text-emerald-600';
  if (score > 80) {
    label = 'CRÍTICO';
    color = 'text-red-600';
  } else if (score > 60) {
    label = 'ALTO';
    color = 'text-orange-600';
  } else if (score > 40) {
    label = 'ELEVADO';
    color = 'text-yellow-600';
  } else if (score > 20) {
    label = 'MODERADO';
    color = 'text-amber-600';
  }

  const top = [...factors]
    .filter((f) => f.count > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 4);

  const summary =
    N === 0
      ? 'Sem processos ativos — índice zerado.'
      : `Índice ${score}/100 (${label}): média ponderada da pressão operacional sobre ${N} processo(s) ativo(s). ` +
        (top.length
          ? `Principais drivers: ${top
              .map((f) => `${f.label} (${f.count}× peso ${f.weight})`)
              .join('; ')}.`
          : '');

  const recommendations: string[] = [];
  if (input.countVencido > 0)
    recommendations.push(`Tratar ${input.countVencido} vencido(s)/crítico(s) na fila de Tarefas hoje.`);
  if (input.countBA > 0)
    recommendations.push(`Priorizar ${input.countBA} caso(s) com indício de B.A. (contato urgente).`);
  if (input.countHoje > 0)
    recommendations.push(`Executar os ${input.countHoje} retorno(s) com prazo “é hoje”.`);
  if (input.countNovoAndamento > 5)
    recommendations.push('Há muitos andamentos novos — rodar Omni Worker e registrar retornos.');
  if (input.countSemPrazo > N * 0.3 && N > 0)
    recommendations.push('Mais de 30% sem próximo prazo — completar agenda de retornos.');
  if (!recommendations.length)
    recommendations.push('Carteira sob controle — manter varredura DataJud/DJEN e retornos no prazo.');

  return {
    score,
    label,
    color,
    formula:
      'score = min(100, round((Σ count×peso / N_ativos)×100)). NÃO mede chance de êxito na ação; mede pressão de fila + sinais críticos (B.A., vencidos, audiências sem aviso).',
    summary,
    factors,
    recommendations,
  };
}
