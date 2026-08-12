/**
 * @fileOverview Motor de Sincronia e Comparação de Datas DataJud v3.2
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { startOfDay, parseISO, isAfter, subDays, parse, isValid } from 'date-fns';

export function gerarHashAuditoria(movimentos: any[]): string {
  if (!movimentos || movimentos.length === 0) return "EMPTY";
  
  const sorted = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  const signature = sorted.slice(0, 3)
    .map(m => `${m.dataHora || ''}|${m.nome || ''}`)
    .join('##');

  try {
    if (typeof btoa !== 'undefined') {
      return btoa(unescape(encodeURIComponent(signature))).substring(0, 32);
    }
    return Buffer.from(signature).toString('base64').substring(0, 32);
  } catch {
    return signature.substring(0, 32);
  }
}

export function detectarEncerradoNoTribunal(movimentos: any[]): {
  encerrado: boolean;
  motivo: string | null;
} {
  if (!movimentos || movimentos.length === 0) {
    return { encerrado: false, motivo: null };
  }

  const sorted = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );
  
  const window = sorted.slice(0, 25);

  const patternGroups = [
    {
      patterns: ['BAIXA DEFINITIVA', 'BAIXA DO PROCESSO', 'BAIXA DEFINITIVA DO FEITO', 'PROCESSO BAIXADO', 'DETERMINADA A BAIXA'],
      label: 'BAIXA DEFINITIVA'
    },
    {
      patterns: ['TRÂNSITO EM JULGADO', 'TRANSITO EM JULGADO', 'CERTIFICADA A TRANSITO', 'CERTIFICADO O TRÂNSITO'],
      label: 'TRÂNSITO EM JULGADO'
    },
    {
      patterns: ['EXTINTO O PROCESSO', 'PROCESSO EXTINTO', 'SENTENÇA DE EXTINÇÃO', 'EXTINÇÃO DO PROCESSO', 'JULGO EXTINTO'],
      label: 'EXTINÇÃO DO PROCESSO'
    },
    {
      patterns: ['ARQUIVAMENTO DEFINITIVO', 'ARQUIVADO DEFINITIVAMENTE', 'ARQUIVEM-SE OS AUTOS', 'AUTOS ARQUIVADOS'],
      label: 'ARQUIVAMENTO DEFINITIVO'
    },
    {
      patterns: ['CANCELADA A DISTRIBUIÇÃO', 'CANCELAMENTO DA DISTRIBUIÇÃO', 'DISTRIBUIÇÃO CANCELADA'],
      label: 'CANCELAMENTO DA DISTRIBUIÇÃO'
    }
  ];

  const constructedWindow = window.map(mov => {
    return `${mov.nome || ''} ${mov.complemento || ''} ${mov.descricao || ''}`.toUpperCase();
  });

  // Movimentos mais recentes que REABREM fase operacional (ex.: cumprimento após trânsito)
  const ACTIVE_AFTER = [
    'CUMPRIMENTO DE SENTENÇA',
    'INÍCIO DE CUMPRIMENTO',
    'PEDIDO DE INÍCIO DE CUMPRIMENTO',
    'REGULARIZAR SEU PEDIDO',
    'ART. 524',
    'ARTIGO 524',
    'PETIÇÃO',
    'DESPACHO',
    'INTIMAÇÃO',
    'ATO ORDINATÓRIO',
    'CONCLUSÃO PARA DESPACHO',
    'EXPEDIÇÃO DE DOCUMENTO',
  ];

  // Encontra índice do fechamento e de atividade posterior
  let closeIdx = -1;
  let closeLabel: string | null = null;
  let closeStrong = false;
  for (let i = 0; i < constructedWindow.length; i++) {
    const text = constructedWindow[i];
    for (const group of patternGroups) {
      if (group.patterns.some((p) => text.includes(p))) {
        closeIdx = i;
        closeLabel = group.label;
        closeStrong = group.label === 'BAIXA DEFINITIVA' || group.label === 'ARQUIVAMENTO DEFINITIVO' || group.label === 'CANCELAMENTO DA DISTRIBUIÇÃO';
        break;
      }
    }
    if (closeIdx >= 0) break;
  }
  if (closeIdx < 0) return { encerrado: false, motivo: null };

  // Atividade mais recente que o "fecho"?
  for (let i = 0; i < closeIdx; i++) {
    const text = constructedWindow[i];
    if (ACTIVE_AFTER.some((p) => text.includes(p))) {
      // Trânsito/baixa antigos + cumprimento/petição depois = processo ATIVO
      return { encerrado: false, motivo: null };
    }
  }

  // Trânsito isolado sem baixa definitiva: só marca se não houver fase ativa na janela
  if (!closeStrong && closeLabel === 'TRÂNSITO EM JULGADO') {
    const anyActive = constructedWindow.some((text) =>
      ACTIVE_AFTER.some((p) => text.includes(p))
    );
    if (anyActive) return { encerrado: false, motivo: null };
  }

  return { encerrado: true, motivo: closeLabel };
}

/**
 * Cumprimento de sentença ATIVO — janela 25 movimentos.
 * Não marca se já houver encerramento definitivo na mesma análise (feito no audit).
 */
export function detectarCumprimentoSentenca(movimentos: any[]): {
  ativo: boolean;
  motivo: string | null;
} {
  if (!movimentos || movimentos.length === 0) {
    return { ativo: false, motivo: null };
  }

  const sorted = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  const window = sorted.slice(0, 25);
  const allText = window.map(m => 
    `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase()
  ).join(' || ');

  const patterns = [
    'CUMPRIMENTO DE SENTENÇA',
    'CUMPRIMENTO DE SENTENCA',
    'EXECUÇÃO/CUMPRIMENTO DE SENTENÇA',
    'EXECUCAO/CUMPRIMENTO DE SENTENCA',
    'EXECUÇÃO/CUMPRIMENTO DE SENTENÇA INICIADA',
    'EXECUCAO/CUMPRIMENTO DE SENTENCA INICIADA',
    'CUMPRIMENTO DE SENTENÇA INICIADA',
    'CUMPRIMENTO DE SENTENCA INICIADA',
    'CUMPRIMENTO PROVISÓRIO DE SENTENÇA',
    'CUMPRIMENTO PROVISORIO DE SENTENCA',
    'CUMPRIMENTO PROVISÓRIO',
    'CUMPRIMENTO PROVISORIO',
    'CUMPRIMENTO DEFINITIVO',
    'FASE DE CUMPRIMENTO',
    'INÍCIO DO CUMPRIMENTO',
    'INICIO DO CUMPRIMENTO',
    'INICIO DO CUMPRIMENTO DE SENTENCA',
    'EXECUÇÃO DE SENTENÇA',
    'EXECUCAO DE SENTENCA',
    'EXECUÇÃO PROVISÓRIA',
    'EXECUCAO PROVISORIA',
    'PROCEDIMENTO DE CUMPRIMENTO',
    'CUMPRIMENTO DE SENTENÇA PROVISÓRIO',
    'REQ. DE CUMPRIMENTO',
    'REQUERIMENTO DE CUMPRIMENTO',
    'PETIÇÃO DE CUMPRIMENTO',
    'PETICAO DE CUMPRIMENTO',
    'INÍCIO DE CUMPRIMENTO',
    'INICIO DE CUMPRIMENTO',
  ];

  for (const p of patterns) {
    if (allText.includes(p)) {
      return { ativo: true, motivo: p };
    }
  }

  // Fallback: "CUMPRIMENTO" + "SENTEN" no mesmo movimento
  for (const m of window) {
    const t = `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase();
    if (t.includes('CUMPRIMENTO') && (t.includes('SENTEN') || t.includes('EXECU'))) {
      return { ativo: true, motivo: 'CUMPRIMENTO (heurística)' };
    }
  }

  return { ativo: false, motivo: null };
}



/** Usa só o último nome salvo (coluna) quando não há lista de movimentos — backfill / UI. */
export function detectarCumprimentoFromNome(ultimoNome: string | null | undefined): {
  ativo: boolean;
  motivo: string | null;
} {
  if (!ultimoNome) return { ativo: false, motivo: null };
  const U = String(ultimoNome).toUpperCase();
  const patterns = [
    'CUMPRIMENTO DE SENTEN',
    'EXECUÇÃO/CUMPRIMENTO',
    'EXECUCAO/CUMPRIMENTO',
    'FASE DE CUMPRIMENTO',
    'INÍCIO DO CUMPRIMENTO',
    'INICIO DO CUMPRIMENTO',
    'EXECUÇÃO DE SENTEN',
    'EXECUCAO DE SENTEN',
    'CUMPRIMENTO PROVIS',
  ];
  for (const p of patterns) {
    if (U.includes(p)) return { ativo: true, motivo: p };
  }
  if (U.includes('CUMPRIMENTO') && (U.includes('SENTEN') || U.includes('EXECU'))) {
    return { ativo: true, motivo: 'CUMPRIMENTO (nome)' };
  }
  return { ativo: false, motivo: null };
}

/** Sentença de mérito a partir de movimentos (janela 25). */
export function detectarSentencaMerito(movimentos: any[]): {
  tipo: 'procedente' | 'improcedente' | 'parcial' | null;
  motivo: string | null;
} {
  if (!movimentos?.length) return { tipo: null, motivo: null };
  const sorted = [...movimentos].sort(
    (a, b) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );
  const window = sorted.slice(0, 25);
  const texts = window.map(
    (m) => `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase()
  );
  for (const t of texts) {
    if (t.includes('PARCIALMENTE PROCEDENTE') || t.includes('PROCEDENTE EM PARTE')) {
      return { tipo: 'parcial', motivo: 'PARCIALMENTE PROCEDENTE' };
    }
  }
  for (const t of texts) {
    if (
      t.includes('JULGADO PROCEDENTE') ||
      t.includes('JULGADA PROCEDENTE') ||
      (t.includes('PROCEDENTE') && !t.includes('IMPROCEDENTE') && !t.includes('PARCIAL'))
    ) {
      return { tipo: 'procedente', motivo: 'PROCEDENTE' };
    }
  }
  for (const t of texts) {
    if (t.includes('IMPROCEDENTE') || t.includes('JULGO IMPROCEDENTE')) {
      return { tipo: 'improcedente', motivo: 'IMPROCEDENTE' };
    }
  }
  return { tipo: null, motivo: null };
}

export function detectarAtualizacaoPosRetorno(
  ultimoRetornoStr: string | null | undefined,
  movimentos: any[]
): { alerta: boolean; dataUltimo: string | null; nomeUltimo: string | null } {
  if (!movimentos || movimentos.length === 0) {
    return { alerta: false, dataUltimo: null, nomeUltimo: null };
  }

  const sorted = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );
  
  const lastMov = sorted[0];
  const dataMov = lastMov.dataHora ? parseISO(lastMov.dataHora) : null;
  
  if (!dataMov) return { alerta: false, dataUltimo: null, nomeUltimo: lastMov.nome || null };

  const dataUltimoStr = dataMov.toISOString();
  const nomeUltimo = lastMov.nome || "Movimentação não identificada";

  if (!ultimoRetornoStr || ultimoRetornoStr.trim() === "" || ultimoRetornoStr === "-" || ultimoRetornoStr === "0") {
    const quarentaECincoDias = startOfDay(subDays(new Date(), 45));
    return {
      alerta: isAfter(dataMov, quarentaECincoDias),
      dataUltimo: dataUltimoStr,
      nomeUltimo
    };
  }

  try {
    let dataRetorno;
    const cleanStr = ultimoRetornoStr.trim();
    if (cleanStr.includes('-')) {
      dataRetorno = parseISO(cleanStr);
    } else if (cleanStr.includes('/')) {
      dataRetorno = parse(cleanStr, 'dd/MM/yyyy', new Date());
    }

    if (dataRetorno && isValid(dataRetorno)) {
      const fimDoDiaRetorno = new Date(dataRetorno);
      fimDoDiaRetorno.setHours(23, 59, 59, 999);

      return {
        alerta: isAfter(dataMov, fimDoDiaRetorno),
        dataUltimo: dataUltimoStr,
        nomeUltimo
      };
    }
    return { alerta: false, dataUltimo: dataUltimoStr, nomeUltimo };
  } catch (e) {
    return { alerta: false, dataUltimo: dataUltimoStr, nomeUltimo };
  }
}
