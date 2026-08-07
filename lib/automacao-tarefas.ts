/**
 * Automação de tarefas jurídicas a partir de flags da carteira.
 * Gera fila acionável (não grava banco — consome em Tarefas / worker).
 */
import type { LegalCase } from './case-logic';
import { isCasoEncerrado } from './status-encerrado';
import {
  pesoFila,
  scorePreditivo,
  rotuloPrioridade,
  faixaPrioridade,
  ordenarFilaCritica,
} from './fila-prioridade';

export type TarefaJuridicaTipo =
  | 'contato_urgente'
  | 'ba'
  | 'audiencia'
  | 'cumprimento'
  | 'custas'
  | 'baixa_tribunal'
  | 'novidade'
  | 'prazo'
  | 'revisao_merito';

export type TarefaJuridica = {
  id: string;
  protocolo: string;
  cliente: string;
  tipo: TarefaJuridicaTipo;
  titulo: string;
  detalhe: string;
  peso: number;
  preditivo: number;
  faixa: string;
  telefone?: string;
};

function tiposDoCaso(c: LegalCase): TarefaJuridicaTipo[] {
  const out: TarefaJuridicaTipo[] = [];
  if (
    c.evento_tipo === 'ba' ||
    (c as any).indicio_busca_apreensao ||
    (c as any).ba_tipo
  )
    out.push('ba');
  if (c.datajud_encerrado_tribunal) out.push('baixa_tribunal');
  if (
    String(c.evento_tipo || '').startsWith('audiencia') ||
    (c as any).tem_audiencia
  )
    out.push('audiencia');
  if (c.em_cumprimento_sentenca || c.evento_tipo === 'cumprimento_sentenca')
    out.push('cumprimento');
  if ((c as any).tem_custas || (c as any).alerta_custas) out.push('custas');
  if (
    c.evento_tipo === 'sentenca_procedente' ||
    c.evento_tipo === 'sentenca_improcedente' ||
    c.evento_tipo === 'sentenca_parcial'
  )
    out.push('revisao_merito');
  if (
    c.tem_novo_andamento ||
    (c as any).tem_atualizacao_pos_retorno ||
    (c as any).djen_nova_comunicacao
  )
    out.push('novidade');
  if (['Caso Crítico', 'Vencido', 'É Hoje'].includes(c.status || ''))
    out.push('prazo');
  if (!out.length && scorePreditivo(c) >= 55) out.push('contato_urgente');
  return out;
}

const TITULO: Record<TarefaJuridicaTipo, string> = {
  contato_urgente: 'Contato urgente',
  ba: 'Busca e apreensão / prisão',
  audiencia: 'Audiência pendente',
  cumprimento: 'Cumprimento de sentença',
  custas: 'Custas / guia',
  baixa_tribunal: 'Baixa no tribunal',
  novidade: 'Novidade processural',
  prazo: 'Prazo crítico',
  revisao_merito: 'Revisão de mérito',
};

/**
 * Gera tarefas jurídicas prioritárias a partir da carteira.
 * Uma tarefa por processo (tipo principal = maior peso contextual).
 */
export function gerarTarefasJuridicas(
  cases: LegalCase[],
  opts?: { limit?: number }
): TarefaJuridica[] {
  const ativos = (cases || []).filter((c) => !isCasoEncerrado(c));
  const ordenados = ordenarFilaCritica(ativos);

  const tarefas: TarefaJuridica[] = [];
  for (const c of ordenados) {
    const tipos = tiposDoCaso(c);
    if (!tipos.length) continue;
    const tipo = tipos[0];
    tarefas.push({
      id: `${c.protocolo}-${tipo}`,
      protocolo: c.protocolo,
      cliente: c.cliente || 'NÃO IDENTIFICADO',
      tipo,
      titulo: TITULO[tipo],
      detalhe: rotuloPrioridade(c),
      peso: pesoFila(c),
      preditivo: scorePreditivo(c),
      faixa: faixaPrioridade(c),
      telefone: c.telefone || undefined,
    });
  }

  tarefas.sort((a, b) => b.peso - a.peso || b.preditivo - a.preditivo);
  return typeof opts?.limit === 'number' ? tarefas.slice(0, opts.limit) : tarefas;
}

/** Resumo para dashboard / automação */
export function resumoAutomacaoTarefas(cases: LegalCase[]) {
  const tarefas = gerarTarefasJuridicas(cases);
  const byTipo: Record<string, number> = {};
  for (const t of tarefas) {
    byTipo[t.tipo] = (byTipo[t.tipo] || 0) + 1;
  }
  return {
    total: tarefas.length,
    criticas: tarefas.filter((t) => t.faixa === 'critica').length,
    byTipo,
    top: tarefas.slice(0, 15),
  };
}
