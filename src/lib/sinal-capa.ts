/**
 * @fileOverview Motor de Seleção de Sinal de Capa v1.0
 * Define qual movimentação (DataJud ou DJEN) deve ser a "capa" do processo baseado em relevância jurídica.
 * @copyright 2026 W1 Capital / Davi Alves Figueredo
 */
import { LegalCase } from './case-logic';
import { summarizeDjenKeywords } from './djen';

export interface SinalCapa {
  titulo: string;
  detalhe: string;
  fonte: 'datajud' | 'djen' | 'ambos';
  data: string | null;
  prioridade: number;
}

/**
 * Retorna o sinal mais relevante para exibição na capa do processo.
 * Hierarquia: BA (100) > Baixa (90) > Mérito (80) > Audiência (70) > Cumprimento (60) > Custas/Partes (50) > Novidade (40) > Rotina (10)
 */
export function getSinalCapa(c: LegalCase): SinalCapa {
  const dataDj = c.datajud_ultimo_movimento;
  const dataDjen = c.djen_ultima_data;

  // 1. PRIORIDADE MÁXIMA: BUSCA E APREENSÃO
  if (c.indicio_busca_apreensao || c.evento_tipo === 'ba') {
    return {
      titulo: 'ALERTA: BUSCA E APREENSÃO',
      detalhe: c.evento_resumo || c.datajud_ultimo_nome || 'Identificado indício de rito de apreensão de bem.',
      fonte: 'datajud',
      data: (c.busca_apreensao_consultado_em || dataDj || null) ?? null,
      prioridade: 100
    };
  }

  // 2. TERMINATIVOS: BAIXA E TRÂNSITO
  if (c.datajud_encerrado_tribunal || c.evento_tipo === 'transito_ou_baixa' || c.evento_tipo === 'transito_baixa') {
    return {
      titulo: 'BAIXA / TRÂNSITO JULGADO',
      detalhe: c.evento_resumo || c.datajud_encerrado_motivo || 'Processo finalizado no tribunal.',
      fonte: 'datajud',
      data: (dataDj || null) ?? null,
      prioridade: 90
    };
  }

  // 3. MÉRITO: SENTENÇAS E LIMINARES
  if (c.evento_tipo?.startsWith('sentenca') || c.evento_tipo === 'liminar') {
    let t = 'DECISÃO / SENTENÇA';
    if (c.evento_tipo === 'sentenca_procedente') t = 'SENTENÇA: PROCEDENTE';
    if (c.evento_tipo === 'sentenca_improcedente') t = 'SENTENÇA: IMPROCEDENTE';
    if (c.evento_tipo === 'sentenca_parcial') t = 'SENTENÇA: PARCIAL';
    if (c.evento_tipo === 'liminar') t = 'LIMINAR CONCEDIDA';
    
    return {
      titulo: t,
      detalhe: c.evento_resumo || 'Nova decisão de mérito identificada.',
      fonte: c.evento_fonte || 'ambos',
      data: (dataDj || dataDjen || null) ?? null,
      prioridade: 80
    };
  }

  // 4. RITOS: AUDIÊNCIAS
  if (c.evento_tipo?.startsWith('audiencia')) {
    return {
      titulo: 'AUDIÊNCIA DESIGNADA',
      detalhe: c.evento_resumo || 'Identificada marcação de audiência nos autos.',
      fonte: c.evento_fonte || 'ambos',
      data: (dataDj || dataDjen || null) ?? null,
      prioridade: 70
    };
  }

  // 5. EXECUÇÃO
  if (c.em_cumprimento_sentenca || c.evento_tipo === 'cumprimento_sentenca') {
    return {
      titulo: 'FASE EXECUTIVA',
      detalhe: c.evento_resumo || c.cumprimento_sentenca_motivo || 'Processo em fase de cumprimento de sentença.',
      fonte: 'datajud',
      data: (dataDj || null) ?? null,
      prioridade: 60
    };
  }

  // 6. GESTÃO: CUSTAS E PARTES
  const combinedText = `${c.evento_resumo || ''} ${c.datajud_ultimo_nome || ''} ${c.djen_ultimo_resumo || ''}`.toUpperCase();
  if (/(CUSTAS|GUIA|PREPARO|HABILITA|SUBSTAB|PARTES|OAB|EXCLU)/.test(combinedText)) {
    return {
      titulo: 'CUSTAS / GESTÃO DE PARTES',
      detalhe: summarizeDjenKeywords(combinedText),
      fonte: c.evento_fonte || 'ambos',
      data: (dataDj || dataDjen || null) ?? null,
      prioridade: 50
    };
  }

  // 7. NOVIDADE DATAJUD
  if (c.tem_atualizacao_pos_retorno && c.datajud_ultimo_nome) {
    return {
      titulo: 'NOVA MOVIMENTAÇÃO',
      detalhe: c.datajud_ultimo_nome,
      fonte: 'datajud',
      data: (dataDj || null) ?? null,
      prioridade: 40
    };
  }

  // 8. NOVIDADE DJEN
  if (c.djen_nova_comunicacao && c.djen_ultimo_resumo) {
    return {
      titulo: 'PUBLICAÇÃO DJEN',
      detalhe: c.djen_ultimo_resumo,
      fonte: 'djen',
      data: (dataDjen || null) ?? null,
      prioridade: 30
    };
  }

  // 9. FALLBACK
  return {
    titulo: 'MONITORAMENTO REGULAR',
    detalhe: c.datajud_ultimo_nome || c.djen_ultimo_resumo || 'Sem novidades relevantes.',
    fonte: 'datajud',
    data: (dataDj || dataDjen || null) ?? null,
    prioridade: 10
  };
}