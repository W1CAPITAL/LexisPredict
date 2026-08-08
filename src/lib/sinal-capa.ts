/**
 * @fileOverview Motor de Seleção de Sinal de Capa v3.0
 * BA removido. Hierarquia: Baixa > Mérito > Audiência > Cumprimento > Gestão > Novidade > Rotina
 * @copyright 2026 W1 Capital / Davi Alves Figueredo
 */
import { LegalCase, sanitizeEventoResumo } from './case-logic';
import { summarizeDjenKeywords } from './djen';

export interface SinalCapa {
  titulo: string;
  detalhe: string;
  fonte: 'datajud' | 'djen' | 'ambos';
  data: string | null;
  prioridade: number;
}

function snippet(text: string | null | undefined, max = 160): string {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.substring(0, max).trim() + '…';
}

function cleanDetalhe(...parts: Array<string | null | undefined>): string {
  for (const p of parts) {
    const s = sanitizeEventoResumo(p) || (p ? String(p).trim() : '');
    const cleaned = sanitizeEventoResumo(s) || s;
    if (cleaned && cleaned.length > 2 && !/^\|+$/.test(cleaned)) {
      return snippet(cleaned, 180);
    }
  }
  return '';
}

/**
 * Retorna o sinal mais relevante para exibição na capa do processo.
 * BA foi desativado — nunca gera alerta de busca e apreensão.
 */
export function getSinalCapa(c: LegalCase): SinalCapa {
  const raw = getSinalCapaRaw(c);
  const titulo = cleanDetalhe(raw.titulo) || raw.titulo;
  const detalhe = cleanDetalhe(raw.detalhe) || raw.detalhe;
  return { ...raw, titulo, detalhe };
}

function getSinalCapaRaw(c: LegalCase): SinalCapa {
  const dataDj = c.datajud_ultimo_movimento;
  const dataDjen = c.djen_ultima_data;

  // 1. TERMINATIVOS: BAIXA E TRÂNSITO
  if (
    c.datajud_encerrado_tribunal ||
    c.evento_tipo === 'transito_ou_baixa' ||
    c.evento_tipo === 'transito_baixa'
  ) {
    return {
      titulo: 'BAIXA / TRÂNSITO JULGADO',
      detalhe:
        c.evento_resumo ||
        c.datajud_encerrado_motivo ||
        c.datajud_ultimo_nome ||
        'Processo finalizado no tribunal.',
      fonte: 'datajud',
      data: (dataDj || null) ?? null,
      prioridade: 90,
    };
  }

  // 2. MÉRITO: SENTENÇAS E LIMINARES
  if (c.evento_tipo?.startsWith('sentenca') || c.evento_tipo === 'liminar') {
    let t = 'DECISÃO / SENTENÇA';
    if (c.evento_tipo === 'sentenca_procedente') t = 'SENTENÇA: PROCEDENTE';
    if (c.evento_tipo === 'sentenca_improcedente') t = 'SENTENÇA: IMPROCEDENTE';
    if (c.evento_tipo === 'sentenca_parcial') t = 'SENTENÇA: PARCIAL';
    if (c.evento_tipo === 'liminar') t = 'LIMINAR CONCEDIDA';

    return {
      titulo: t,
      detalhe:
        c.evento_resumo ||
        c.datajud_ultimo_nome ||
        c.djen_ultimo_resumo ||
        'Nova decisão de mérito identificada.',
      fonte: (c.evento_fonte as any) || 'ambos',
      data: (dataDj || dataDjen || null) ?? null,
      prioridade: 80,
    };
  }

  // 3. RITOS: AUDIÊNCIAS
  if (c.evento_tipo?.startsWith('audiencia')) {
    return {
      titulo: 'AUDIÊNCIA DESIGNADA',
      detalhe:
        c.evento_resumo ||
        c.datajud_ultimo_nome ||
        'Identificada marcação de audiência nos autos.',
      fonte: (c.evento_fonte as any) || 'ambos',
      data: (dataDj || dataDjen || null) ?? null,
      prioridade: 70,
    };
  }

  // 4. EXECUÇÃO
  if (c.em_cumprimento_sentenca || c.evento_tipo === 'cumprimento_sentenca') {
    return {
      titulo: 'FASE EXECUTIVA',
      detalhe:
        c.evento_resumo ||
        c.cumprimento_sentenca_motivo ||
        'Processo em fase de cumprimento de sentença.',
      fonte: 'datajud',
      data: (dataDj || null) ?? null,
      prioridade: 60,
    };
  }

  // 5. GESTÃO: CUSTAS E PARTES
  const combinedText = `${c.evento_resumo || ''} ${c.datajud_ultimo_nome || ''} ${c.djen_ultimo_resumo || ''}`.toUpperCase();
  if (/(CUSTAS|GUIA|PREPARO|HABILITA|SUBSTAB|PARTES|OAB|EXCLU)/.test(combinedText)) {
    return {
      titulo: 'CUSTAS / GESTÃO DE PARTES',
      detalhe:
        c.evento_resumo ||
        summarizeDjenKeywords(combinedText) ||
        snippet(c.djen_ultimo_resumo || c.datajud_ultimo_nome),
      fonte: (c.evento_fonte as any) || 'ambos',
      data: (dataDj || dataDjen || null) ?? null,
      prioridade: 50,
    };
  }

  // 6. NOVIDADE DATAJUD
  if (c.tem_atualizacao_pos_retorno && c.datajud_ultimo_nome) {
    return {
      titulo: 'NOVA MOVIMENTAÇÃO',
      detalhe: c.evento_resumo || c.datajud_ultimo_nome,
      fonte: 'datajud',
      data: (dataDj || null) ?? null,
      prioridade: 40,
    };
  }

  // 7. NOVIDADE DJEN
  if (c.djen_nova_comunicacao && c.djen_ultimo_resumo) {
    return {
      titulo: 'PUBLICAÇÃO DJEN',
      detalhe: c.evento_resumo || snippet(c.djen_ultimo_resumo, 180),
      fonte: 'djen',
      data: (dataDjen || null) ?? null,
      prioridade: 30,
    };
  }

  // 8. FALLBACK
  return {
    titulo: 'MONITORAMENTO REGULAR',
    detalhe:
      c.evento_resumo ||
      c.datajud_ultimo_nome ||
      c.djen_ultimo_resumo ||
      'Sem novidades relevantes.',
    fonte: 'datajud',
    data: (dataDj || dataDjen || null) ?? null,
    prioridade: 10,
  };
}
