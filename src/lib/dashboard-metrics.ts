/**
 * Métricas do Dashboard — uma fonte para cards e telemetria.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import type { LegalCase } from './case-logic';
import { isCasoEncerrado } from './status-encerrado';
import { resolveTemNovoAndamento } from './novidade';
import {
  hasAudienciaPosRetorno,
  isSentencaImprocedente,
  isSentencaProcedente,
} from './merito-detect';

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

  const countVencido = ativos.filter(
    (c) => c.status === 'Vencido' || c.status === 'Caso Crítico'
  ).length;
  const countHoje = ativos.filter((c) => c.status === 'É Hoje').length;
  const countAtencao = ativos.filter((c) => c.status === 'Atenção').length;
  const countSaudavel = ativos.filter((c) => c.status === 'No Prazo').length;
  const countSemPrazo = ativos.filter((c) => c.status === 'Sem Prazo').length;

  const countNovoAndamento = ativos.filter((c) => resolveTemNovoAndamento(c)).length;
  const countEncerradoTribunal = ativos.filter((c) => !!c.datajud_encerrado_tribunal).length;
  const countCumprimento = ativos.filter((c) => !!c.em_cumprimento_sentenca).length;

  const countProcedente = ativos.filter((c) => isSentencaProcedente(c)).length;
  const countImprocedente = ativos.filter((c) => isSentencaImprocedente(c)).length;
  const countAudienciaPosRetorno = ativos.filter((c) => hasAudienciaPosRetorno(c)).length;

  const rateAndamento =
    activeTotal > 0 ? Math.round((countNovoAndamento / activeTotal) * 100) : 0;

  const riskSum =
    countVencido * 1.0 +
    countHoje * 0.8 +
    countAtencao * 0.5 +
    countImprocedente * 0.6 +
    countAudienciaPosRetorno * 0.4 +
    countSaudavel * 0.1;
  const riskScore =
    activeTotal > 0 ? Math.min(100, Math.round((riskSum / activeTotal) * 100)) : 0;

  let riskLabel = 'BAIXO';
  let riskColor = 'text-emerald-600';
  if (riskScore > 80) {
    riskLabel = 'CRÍTICO';
    riskColor = 'text-red-600';
  } else if (riskScore > 60) {
    riskLabel = 'ALTO';
    riskColor = 'text-orange-600';
  } else if (riskScore > 40) {
    riskLabel = 'ELEVADO';
    riskColor = 'text-yellow-600';
  } else if (riskScore > 20) {
    riskLabel = 'MODERADO';
    riskColor = 'text-amber-600';
  }

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
    riskScore,
    riskLabel,
    riskColor,
    statusData,
    countNovoAndamento,
    rateAndamento,
    countEncerradoTribunal,
    countBA: 0,
    countCumprimento,
    countProcedente,
    countImprocedente,
    countAudienciaPosRetorno,
  };
}
