/**
 * BI leve + compliance operacional a partir da carteira (sem Power BI).
 * @copyright 2026 W1 / LexisPredict
 */
import type { LegalCase } from './case-logic';
import { isCasoEncerrado } from './status-encerrado';

export type BiKpi = {
  id: string;
  label: string;
  value: number;
  unit?: string;
  hint?: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'bad';
};

export type ComplianceFlag = {
  id: string;
  severity: 'info' | 'warn' | 'critical';
  title: string;
  detail: string;
  count: number;
};

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const ms = Date.now() - d.getTime();
    return Math.floor(ms / 86400000);
  } catch {
    return null;
  }
}

export function buildBiCompliance(cases: LegalCase[]) {
  const ativos = cases.filter((c) => !isCasoEncerrado(c));
  const total = cases.length;
  const active = ativos.length;

  const novidade = ativos.filter(
    (c) =>
      c.tem_atualizacao_pos_retorno ||
      c.tem_novo_andamento ||
      c.djen_nova_comunicacao
  );
  const ba = ativos.filter((c) => c.indicio_busca_apreensao);
  const baixa = ativos.filter((c) => c.datajud_encerrado_tribunal);
  const cumprimento = ativos.filter(
    (c) => c.em_cumprimento_sentenca || c.evento_tipo === 'cumprimento_sentenca'
  );
  const vencidos = ativos.filter(
    (c) => c.status === 'Vencido' || c.status === 'Caso Crítico'
  );
  const semRetorno7 = ativos.filter((c) => {
    const d = daysSince(
      (c.ultimoRetorno as any) || (c as any).ultimo_retorno || null
    );
    return d === null || d >= 7;
  });
  const novidadeAberta7 = novidade.filter((c) => {
    const d = daysSince(
      c.datajud_ultimo_movimento || c.djen_ultima_data || null
    );
    return d !== null && d >= 7;
  });
  const semPrazo = ativos.filter(
    (c) => c.status === 'Sem Prazo' || !(c as any).proximoPrazo
  );
  const auditados = ativos.filter(
    (c) => c.datajud_consultado_em || c.djen_ultima_data
  );

  const coberturaAudit =
    active > 0 ? Math.round((auditados.length / active) * 100) : 0;
  const taxaNovidade =
    active > 0 ? Math.round((novidade.length / active) * 100) : 0;
  const taxaVencido =
    active > 0 ? Math.round((vencidos.length / active) * 100) : 0;

  const kpis: BiKpi[] = [
    {
      id: 'ativos',
      label: 'Ativos',
      value: active,
      hint: `${total} na carteira total`,
      tone: 'neutral',
    },
    {
      id: 'cobertura',
      label: 'Cobertura de auditoria',
      value: coberturaAudit,
      unit: '%',
      hint: 'Processos com DataJud ou DJEN consultado',
      tone: coberturaAudit >= 70 ? 'ok' : coberturaAudit >= 40 ? 'warn' : 'bad',
    },
    {
      id: 'novidade',
      label: 'Com novidade aberta',
      value: novidade.length,
      unit: `(${taxaNovidade}%)`,
      tone: novidade.length > 50 ? 'warn' : 'neutral',
    },
    {
      id: 'novidade7',
      label: 'Novidade > 7 dias sem contato',
      value: novidadeAberta7.length,
      tone: novidadeAberta7.length > 0 ? 'bad' : 'ok',
      hint: 'Compliance de retorno',
    },
    {
      id: 'vencidos',
      label: 'Vencidos / críticos',
      value: vencidos.length,
      unit: `(${taxaVencido}%)`,
      tone: taxaVencido > 40 ? 'bad' : 'warn',
    },
    {
      id: 'ba',
      label: 'Indícios B.A.',
      value: ba.length,
      tone: ba.length > 0 ? 'bad' : 'ok',
    },
    {
      id: 'cumprimento',
      label: 'Em cumprimento',
      value: cumprimento.length,
      tone: 'neutral',
    },
    {
      id: 'baixa_trib',
      label: 'Baixa no tribunal (ainda ativos)',
      value: baixa.length,
      tone: baixa.length > 0 ? 'warn' : 'ok',
      hint: 'Reconciliar status interno',
    },
  ];

  const compliance: ComplianceFlag[] = [];

  if (novidadeAberta7.length > 0) {
    compliance.push({
      id: 'sla_novidade',
      severity: 'critical',
      title: 'SLA de retorno em novidade',
      detail: `${novidadeAberta7.length} processo(s) com movimentação há 7+ dias e sem evidência de contato recente.`,
      count: novidadeAberta7.length,
    });
  }
  if (ba.length > 0) {
    compliance.push({
      id: 'ba_pendente',
      severity: 'critical',
      title: 'Busca e apreensão sem triagem explícita',
      detail: `${ba.length} indício(s) de B.A. na carteira ativa — priorizar validação de vínculo com o CNJ.`,
      count: ba.length,
    });
  }
  if (baixa.length > 10) {
    compliance.push({
      id: 'baixa_orfao',
      severity: 'warn',
      title: 'Baixa no tribunal vs status interno',
      detail: `${baixa.length} ativos ainda marcados com baixa/trânsito no tribunal. Revisar arquivamento interno.`,
      count: baixa.length,
    });
  }
  if (coberturaAudit < 40) {
    compliance.push({
      id: 'cobertura',
      severity: 'warn',
      title: 'Cobertura de scanner baixa',
      detail: `Só ${coberturaAudit}% dos ativos têm consulta DataJud/DJEN registrada.`,
      count: active - auditados.length,
    });
  }
  if (semRetorno7.length > active * 0.5 && active > 20) {
    compliance.push({
      id: 'contato',
      severity: 'info',
      title: 'Carteira com pouco retorno recente',
      detail: `${semRetorno7.length} ativos sem retorno nos últimos 7 dias (ou sem data).`,
      count: semRetorno7.length,
    });
  }
  if (semPrazo.length > active * 0.35 && active > 20) {
    compliance.push({
      id: 'sem_prazo',
      severity: 'info',
      title: 'Alta parcela sem prazo',
      detail: `${semPrazo.length} ativos sem prazo cadastrado — agenda e KPIs ficam cegos.`,
      count: semPrazo.length,
    });
  }
  if (compliance.length === 0) {
    compliance.push({
      id: 'ok',
      severity: 'info',
      title: 'Sem alerta crítico de compliance operacional',
      detail: 'Nenhum desvio grave automático. Mantenha scanner e fila de contato em rotina.',
      count: 0,
    });
  }

  // Distribuição por tribunal (BI simples)
  const porTribunal: Record<string, number> = {};
  for (const c of ativos) {
    const t = String(c.tribunal || 'N/D').toUpperCase();
    porTribunal[t] = (porTribunal[t] || 0) + 1;
  }
  const topTribunais = Object.entries(porTribunal)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  // Por escritório
  const porEscritorio: Record<string, number> = {};
  for (const c of ativos) {
    const e = String(c.escritorio || 'Sem escritório');
    porEscritorio[e] = (porEscritorio[e] || 0) + 1;
  }
  const topEscritorios = Object.entries(porEscritorio)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  return {
    kpis,
    compliance,
    topTribunais,
    topEscritorios,
    generatedAt: new Date().toISOString(),
  };
}
