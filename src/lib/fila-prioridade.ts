/**
 * Nota: módulo BA desativado (busca-apreensao.ts). Não priorizar falso positivo de BA.
 *
 * Priorização automática + camada preditiva (heurística + sinais Claude).
 * Pesos calibrados para carteira de volume (1000+ processos).
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

/** Pesos base — ajustáveis sem mudar a hierarquia */
export const PRIORITY_WEIGHTS: Record<string, number> = {
  ba_prisao: 1500,
  ba_veiculo: 1420,
  ba_imovel: 1360,
  ba_penhora: 1300,
  ba_generico: 1240,
  ba_geo_penalty: -40, // outro estado: ainda urgente, mas um pouco abaixo

  baixa_tribunal: 980,
  sentenca_improcedente: 900,
  sentenca_procedente: 860,
  sentenca_parcial: 820,
  sentenca_generica: 780,

  audiencia: 740,
  cumprimento: 680,

  ia_critica: 620,
  ia_alta: 480,
  ia_alerta: 400,
  custas: 360,

  novidade: 420,

  status_critico: 380,
  status_vencido: 320,
  status_hoje: 280,
  status_atencao: 140,

  /** Dados de contato (campo em branco = impossível agir na urgência) */
  sem_telefone_cap: 120,
  sem_advogado_cap: 70,
  sem_cpf_cap: 40,

  /** Camada preditiva (0–max) */
  pred_sem_retorno_cap: 100,
  pred_prazo_cap: 40,
  pred_scan_priority_cap: 80,
  pred_risco_compound_cap: 120,
};

function baTipo(c: LegalCase): string | null {
  const t = (c as any).ba_tipo || (c as any).busca_apreensao_tipo || null;
  if (t) return String(t).toUpperCase();
  if (c.evento_tipo === 'ba' || (c as any).indicio_busca_apreensao) return null; // BA desativado no produto
  return null;
}

function temBaOperacional(_c: LegalCase): boolean {
  // Produto: módulo BA desativado (falsos positivos). Nunca priorizar BA.
  return false;
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

function diasSemRetorno(ultimoRetorno?: string | null): number {
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

/**
 * Score preditivo 0–100: probabilidade operacional de “precisar de contato já”.
 * Não substitui o peso jurídico; multiplica/compõe o risco.
 */
export function scorePreditivo(c: LegalCase): number {
  let s = 0;

  // Sinais duros
  if (temBaOperacional(c)) s += 35;
  if (c.datajud_encerrado_tribunal) s += 22;
  if (isSentencaImprocedente(c)) s += 20;
  if (isSentencaProcedente(c)) s += 12;
  if (temCumprimento(c)) s += 18;
  if (temAudiencia(c)) s += 16;
  if (temNovidade(c)) s += 14;
  if ((c as any).tem_custas || (c as any).alerta_custas) s += 10;

  // Claude / OmniRoute
  const sev = String((c as any).ai_severidade || '').toLowerCase();
  if (sev === 'critica') s += 25;
  else if (sev === 'alta') s += 18;
  else if (sev === 'media') s += 8;
  if ((c as any).prioridade_critica_ia || (c as any).alerta_ia) s += 15;
  if ((c as any).ai_alertar) s += 8;

  // Comportamento operacional
  const dias = diasSemRetorno(c.ultimoRetorno);
  s += Math.min(20, Math.floor(dias / 5)); // 0–20 conforme atraso de contato

  if (c.status === 'Caso Crítico' || c.status === 'Vencido') s += 12;
  else if (c.status === 'É Hoje') s += 8;
  else if (c.status === 'Atenção') s += 4;

  // scan_priority 0–100 → até 10 pts
  if (typeof (c as any).scan_priority === 'number') {
    s += Math.min(10, Math.round((c as any).scan_priority / 10));
  }

  // Faltam dados de ação? Municipa para cima (não agrava sozinho, mas desempata)
  const semTel =
    !c.telefone || c.telefone === '-' || String(c.telefone).trim().length < 8;
  const semAdv = !c.advogado || c.advogado === '-';
  if (semTel) s += 4;
  if (semAdv) s += 3;

  return Math.max(0, Math.min(100, Math.round(s)));
}

/** Interpretação do score preditivo */
export function rotuloPreditivo(score: number): string {
  if (score >= 75) return 'Risco preditivo crítico';
  if (score >= 55) return 'Risco preditivo alto';
  if (score >= 35) return 'Atenção preditiva';
  if (score >= 20) return 'Monitorar';
  return 'Estável';
}

/** Peso maior = mais urgente */
export function pesoFila(c: LegalCase): number {
  const W = PRIORITY_WEIGHTS;
  let w = 0;

  // 0. BA
  if (temBaOperacional(c)) {
    const tipo = baTipo(c);
    const geo = !!(c as any).ba_geo_distante;
    let base: number = W.ba_generico as number;
    if (tipo === 'PRISAO') base = W.ba_prisao as number;
    else if (tipo === 'VEICULO') base = W.ba_veiculo as number;
    else if (tipo === 'IMOVEL') base = W.ba_imovel as number;
    else if (tipo === 'PENHORA_BENS') base = W.ba_penhora as number;
    w += base + (geo ? W.ba_geo_penalty : 0);
  }

  // 1. Baixa
  if (
    c.datajud_encerrado_tribunal ||
    c.evento_tipo === 'transito_ou_baixa' ||
    c.evento_tipo === 'transito_baixa'
  ) {
    w += W.baixa_tribunal;
  }

  // 2. Sentença
  if (isSentencaImprocedente(c) || c.evento_tipo === 'sentenca_improcedente')
    w += W.sentenca_improcedente;
  else if (isSentencaProcedente(c) || c.evento_tipo === 'sentenca_procedente')
    w += W.sentenca_procedente;
  else if (c.evento_tipo === 'sentenca_parcial' || c.evento_tipo === 'liminar')
    w += W.sentenca_parcial;
  else if (String(c.evento_tipo || '').startsWith('sentenca'))
    w += W.sentenca_generica;

  // 3. Audiência
  if (temAudiencia(c)) w += W.audiencia;

  // 4. Cumprimento
  if (temCumprimento(c)) w += W.cumprimento;

  // 5. IA Claude
  const sev = String((c as any).ai_severidade || '').toLowerCase();
  if (sev === 'critica' || (c as any).prioridade_critica_ia) w += W.ia_critica;
  else if (sev === 'alta') w += W.ia_alta;
  else if ((c as any).alerta_ia || (c as any).ai_alertar) w += W.ia_alerta;

  if ((c as any).tem_custas || (c as any).alerta_custas) w += W.custas;

  // 6. Novidade
  if (temNovidade(c)) w += W.novidade;

  // 7. Prazo
  if (c.status === 'Caso Crítico') w += W.status_critico;
  else if (c.status === 'Vencido') w += W.status_vencido;
  else if (c.status === 'É Hoje') w += W.status_hoje;
  else if (c.status === 'Atenção') w += W.status_atencao;

  const dias = diasSemRetorno(c.ultimoRetorno);

  // 7b. Dados de contato — uma urgência sem como contatar o cliente perde elo de ação
  const semTel =
    !c.telefone || c.telefone === '-' || String(c.telefone).trim().length < 8;
  const semAdv = !c.advogado || c.advogado === '-';
  const semCpf = !(c as any).cpf || String((c as any).cpf).length < 11;
  if (w > 0 || temNovidade(c)) {
    if (semTel) w += Math.min(W.sem_telefone_cap, 40 + Math.floor(dias / 10));
    if (semAdv) w += W.sem_advogado_cap;
    if (semCpf) w += W.sem_cpf_cap;
  }

  // 8. Camada preditiva (compõe, não domina BA/sentença)
  const pred = scorePreditivo(c);
  w += Math.round((pred / 100) * W.pred_risco_compound_cap);

  w += Math.min(W.pred_sem_retorno_cap, Math.floor(dias / 2));

  if (typeof c.diasFaltando === 'number') {
    w += Math.min(W.pred_prazo_cap, Math.max(0, 30 - c.diasFaltando));
  }

  if (typeof (c as any).scan_priority === 'number') {
    w += Math.min(
      W.pred_scan_priority_cap,
      Math.max(0, (c as any).scan_priority)
    );
  }

  return w;
}

export type FaixaPrioridade =
  | 'critica'
  | 'alta'
  | 'media'
  | 'baixa'
  | 'rotina';

export function faixaPrioridade(c: LegalCase): FaixaPrioridade {
  const p = pesoFila(c);
  const pred = scorePreditivo(c);
  // Faixa híbrida: peso estrutural + preditivo
  if (p >= 1200 || pred >= 75) return 'critica';
  if (p >= 750 || pred >= 55) return 'alta';
  if (p >= 450 || pred >= 35) return 'media';
  if (p >= 250 || pred >= 20) return 'baixa';
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
        scorePreditivo(c) >= 35 ||
        ['Caso Crítico', 'Vencido', 'É Hoje', 'Atenção'].includes(c.status || '')
    )
    .sort((a, b) => {
      const d = pesoFila(b) - pesoFila(a);
      if (d !== 0) return d;
      return scorePreditivo(b) - scorePreditivo(a);
    });

  return typeof limit === 'number' ? list.slice(0, limit) : list;
}

export function pesoGrupo(cases: LegalCase[]): number {
  if (!cases?.length) return 0;
  return Math.max(...cases.map((c) => pesoFila(c)));
}

export function predGrupo(cases: LegalCase[]): number {
  if (!cases?.length) return 0;
  return Math.max(...cases.map((c) => scorePreditivo(c)));
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
  const pred = scorePreditivo(c);
  if (pred >= 55) return rotuloPreditivo(pred);
  return 'Acompanhar';
}

export function priorizarAutomatico(
  cases: LegalCase[],
  opts?: { limit?: number; onlyCritical?: boolean }
): Array<{
  case: LegalCase;
  peso: number;
  preditivo: number;
  faixa: FaixaPrioridade;
  rotulo: string;
  rotuloPred: string;
}> {
  let list = (cases || []).filter((c) => !isCasoEncerrado(c));
  if (opts?.onlyCritical) {
    list = ordenarFilaCritica(list, opts.limit);
  } else {
    list = [...list].sort((a, b) => {
      const d = pesoFila(b) - pesoFila(a);
      if (d !== 0) return d;
      return scorePreditivo(b) - scorePreditivo(a);
    });
    if (typeof opts?.limit === 'number') list = list.slice(0, opts.limit);
  }
  return list.map((c) => {
    const pred = scorePreditivo(c);
    return {
      case: c,
      peso: pesoFila(c),
      preditivo: pred,
      faixa: faixaPrioridade(c),
      rotulo: rotuloPrioridade(c),
      rotuloPred: rotuloPreditivo(pred),
    };
  });
}
