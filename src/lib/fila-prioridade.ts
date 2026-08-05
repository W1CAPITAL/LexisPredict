/**
 * Priorização automática da fila crítica (Tarefas + Dashboard).
 * Score único e estável — quanto maior, mais urgente.
 *
 * Hierarquia:
 * 0 BA operacional (prisão > veículo > imóvel > penhora > genérico)
 * 1 Baixa / trânsito no tribunal
 * 2 Sentença (improcedente > procedente > parcial)
 * 3 Audiência pendente
 * 4 Cumprimento de sentença
 * 5 Custas / prioridade IA Claude
 * 6 Novidade pós-retorno (DataJud ∪ DJEN)
 * 7 Status de prazo (crítico / vencido / hoje / atenção)
 * 8 Tempo sem retorno + dias de prazo
 *
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

function baTipo(c: LegalCase): string | null {
  const t = (c as any).ba_tipo || (c as any).busca_apreensao_tipo || null;
  if (t) return String(t).toUpperCase();
  if (c.evento_tipo === 'ba' || (c as any).indicio_busca_apreensao) return 'GENERICO';
  return null;
}

function temBaOperacional(c: LegalCase): boolean {
  if ((c as any).ba_alertar_operacional === false) return false;
  // Geo distante ainda prioriza, mas um pouco abaixo (operador precisa ver)
  return !!(
    c.evento_tipo === 'ba' ||
    (c as any).indicio_busca_apreensao ||
    baTipo(c)
  );
}

function temNovidade(c: LegalCase): boolean {
  return !!(
    resolveTemNovoAndamento(c) ||
    c.tem_novo_andamento ||
    (c as any).tem_atualizacao_pos_retorno ||
    (c as any).djen_nova_comunicacao
  );
}

function temAudiencia(c: LegalCase): boolean {
  if ((c as any).tem_audiencia) return true;
  if (String(c.evento_tipo || '').startsWith('audiencia')) return true;
  return hasAudienciaPosRetorno(c);
}

function temCumprimento(c: LegalCase): boolean {
  return !!(
    c.em_cumprimento_sentenca ||
    c.evento_tipo === 'cumprimento_sentenca' ||
    (c as any).cumprimento_sentenca
  );
}

/** Peso maior = mais urgente (ordenar desc) */
export function pesoFila(c: LegalCase): number {
  let w = 0;

  // 0. Busca e apreensão
  if (temBaOperacional(c)) {
    const tipo = baTipo(c);
    const geoDist = !!(c as any).ba_geo_distante;
    if (tipo === 'PRISAO') w += geoDist ? 1480 : 1500;
    else if (tipo === 'VEICULO') w += geoDist ? 1430 : 1450;
    else if (tipo === 'IMOVEL') w += geoDist ? 1380 : 1400;
    else if (tipo === 'PENHORA_BENS') w += geoDist ? 1330 : 1350;
    else w += geoDist ? 1280 : 1300;
  }

  // 1. Baixa / trânsito
  if (
    c.datajud_encerrado_tribunal ||
    c.evento_tipo === 'transito_ou_baixa' ||
    c.evento_tipo === 'transito_baixa'
  ) {
    w += 1000;
  }

  // 2. Sentença
  if (isSentencaImprocedente(c) || c.evento_tipo === 'sentenca_improcedente') w += 920;
  else if (isSentencaProcedente(c) || c.evento_tipo === 'sentenca_procedente') w += 900;
  else if (c.evento_tipo === 'sentenca_parcial' || c.evento_tipo === 'liminar') w += 880;
  else if (String(c.evento_tipo || '').startsWith('sentenca')) w += 860;

  // 3. Audiência pendente
  if (temAudiencia(c)) w += 800;

  // 4. Cumprimento
  if (temCumprimento(c)) w += 700;

  // 5. Claude / custas / prioridade IA
  if ((c as any).prioridade_critica_ia || (c as any).alerta_ia) w += 650;
  if ((c as any).tem_custas || (c as any).alerta_custas) w += 620;
  if ((c as any).ai_severidade === 'critica') w += 50;
  else if ((c as any).ai_severidade === 'alta') w += 30;

  // 6. Novidade pós-retorno
  if (temNovidade(c)) w += 500;

  // 7. Prazo
  if (c.status === 'Caso Crítico') w += 400;
  else if (c.status === 'Vencido') w += 350;
  else if (c.status === 'É Hoje') w += 300;
  else if (c.status === 'Atenção') w += 150;

  // 8. Tempo sem retorno + prazo
  const dias = diasSemRetorno(c.ultimoRetorno);
  if (dias != null) w += Math.min(120, Math.floor(dias / 2));
  if (typeof c.diasFaltando === 'number') w += Math.max(0, 30 - c.diasFaltando);

  // scan_priority gravado pelo motor (0–100)
  if (typeof (c as any).scan_priority === 'number') {
    w += Math.min(100, Math.max(0, (c as any).scan_priority));
  }

  return w;
}

function diasSemRetorno(ultimoRetorno?: string | null): number | null {
  if (!ultimoRetorno || !String(ultimoRetorno).trim()) return 90;
  try {
    const raw = String(ultimoRetorno).trim();
    const d = new Date(
      raw.includes('/') ? raw.split('/').reverse().join('-') : raw
    );
    if (Number.isNaN(d.getTime())) return 60;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  } catch {
    return 60;
  }
}

/** Faixa automática para UI */
export type FaixaPrioridade =
  | 'critica'
  | 'alta'
  | 'media'
  | 'baixa'
  | 'rotina';

export function faixaPrioridade(c: LegalCase): FaixaPrioridade {
  const p = pesoFila(c);
  if (p >= 1200) return 'critica';
  if (p >= 800) return 'alta';
  if (p >= 500) return 'media';
  if (p >= 300) return 'baixa';
  return 'rotina';
}

export function ordenarFilaCritica(
  cases: LegalCase[],
  limit?: number
): LegalCase[] {
  const list = cases
    .filter((c) => !isCasoEncerrado(c))
    .filter(
      (c) =>
        temBaOperacional(c) ||
        temNovidade(c) ||
        c.datajud_encerrado_tribunal ||
        temCumprimento(c) ||
        temAudiencia(c) ||
        isSentencaProcedente(c) ||
        isSentencaImprocedente(c) ||
        (c as any).prioridade_critica_ia ||
        (c as any).alerta_ia ||
        ['Caso Crítico', 'Vencido', 'É Hoje', 'Atenção'].includes(c.status || '')
    )
    .sort((a, b) => pesoFila(b) - pesoFila(a));

  return typeof limit === 'number' ? list.slice(0, limit) : list;
}

/** Prioridade automática de um grupo (cliente com vários CNJs) = max dos processos */
export function pesoGrupo(cases: LegalCase[]): number {
  if (!cases?.length) return 0;
  return Math.max(...cases.map((c) => pesoFila(c)));
}

export function rotuloPrioridade(c: LegalCase): string {
  if (temBaOperacional(c)) {
    const t = baTipo(c);
    if (t === 'PRISAO') return 'Mandado de prisão';
    if (t === 'VEICULO') return 'BA veículo';
    if (t === 'IMOVEL') return 'BA / penhora imóvel';
    if (t === 'PENHORA_BENS') return 'Penhora de bens';
    if ((c as any).ba_geo_distante) return 'BA outro estado';
    return 'Busca e apreensão';
  }
  if (c.datajud_encerrado_tribunal) return 'Baixa no tribunal';
  if (isSentencaImprocedente(c)) return 'Sentença improcedente';
  if (isSentencaProcedente(c)) return 'Sentença procedente';
  if (temAudiencia(c)) return 'Audiência pendente';
  if (temCumprimento(c)) return 'Cumprimento';
  if ((c as any).prioridade_critica_ia || (c as any).alerta_ia)
    return 'Prioridade IA';
  if ((c as any).tem_custas) return 'Custas';
  if (temNovidade(c)) return 'Nova movimentação';
  if (c.status === 'Vencido' || c.status === 'Caso Crítico') return 'Prazo vencido';
  if (c.status === 'É Hoje') return 'Prazo hoje';
  return 'Acompanhar';
}

/**
 * Aplica priorização automática: devolve lista ordenada + metadados.
 * Use na fila de Tarefas e no preview do Dashboard.
 */
export function priorizarAutomatico(
  cases: LegalCase[],
  opts?: { limit?: number; onlyCritical?: boolean }
): Array<{ case: LegalCase; peso: number; faixa: FaixaPrioridade; rotulo: string }> {
  let list = (cases || []).filter((c) => !isCasoEncerrado(c));
  if (opts?.onlyCritical) {
    list = ordenarFilaCritica(list, opts.limit);
  } else {
    list = [...list].sort((a, b) => pesoFila(b) - pesoFila(a));
    if (typeof opts?.limit === 'number') list = list.slice(0, opts.limit);
  }
  return list.map((c) => ({
    case: c,
    peso: pesoFila(c),
    faixa: faixaPrioridade(c),
    rotulo: rotuloPrioridade(c),
  }));
}
