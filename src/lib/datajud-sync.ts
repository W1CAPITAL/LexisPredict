/**
 * @fileOverview Motor de Sincronia e Comparação de Datas DataJud v3.1
 * Regras de Negócio:
 * 1. tem_atualizacao_pos_retorno = estritamente DataMovimento > DataRetorno.
 * 2. Movimentos no mesmo dia são considerados vistos.
 * 3. Se não houver data de movimento, não há alerta.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { startOfDay, parseISO, isAfter, subDays, parse, isValid } from 'date-fns';

/**
 * Gera uma assinatura (hash) do estado atual das movimentações.
 * Usado para integridade, mas NÃO liga a flag de novo andamento.
 */
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

/**
 * Analisa os movimentos recentes do tribunal para detectar encerramento definitivo.
 */
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
      patterns: ['BAIXA DEFINITIVA', 'BAIXA DO PROCESSO', 'BAIXA DEFINITIVA DO FEITO', 'PROCESSO BAIXADO'],
      label: 'BAIXA DEFINITIVA'
    },
    {
      patterns: ['TRÂNSITO EM JULGADO', 'TRANSITO EM JULGADO', 'CERTIFICADA A TRANSITO'],
      label: 'TRÂNSITO EM JULGADO'
    },
    {
      patterns: ['EXTINTO O PROCESSO', 'PROCESSO EXTINTO', 'SENTENÇA DE EXTINÇÃO', 'EXTINÇÃO DO PROCESSO'],
      label: 'EXTINÇÃO DO PROCESSO'
    },
    {
      patterns: ['ARQUIVAMENTO DEFINITIVO', 'ARQUIVADO DEFINITIVAMENTE', 'ARQUIVEM-SE OS AUTOS', 'AUTOS ARQUIVADOS'],
      label: 'ARQUIVAMENTO DEFINITIVO'
    }
  ];

  const constructedWindow = window.map(mov => {
    return `${mov.nome || ''} ${mov.complemento || ''} ${mov.descricao || ''}`.toUpperCase();
  });

  for (const group of patternGroups) {
    if (constructedWindow.some(text => group.patterns.some(p => text.includes(p)))) {
      return { encerrado: true, motivo: group.label };
    }
  }

  return { encerrado: false, motivo: null };
}

/**
 * Detecta se o processo está em fase de Cumprimento de Sentença / Execução.
 * Analisa a janela dos 20 movimentos mais recentes.
 */
export function detectarCumprimentoSentenca(movimentos: any[]): {
  ativo: boolean;
  motivo: string | null;
} {
  if (!movimentos || movimentos.length === 0) {
    return { ativo: false, motivo: null };
  }

  // Ordenação DESC por segurança
  const sorted = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  // Analisar janela de 20
  const window = sorted.slice(0, 20);
  const allText = window.map(m => 
    `${m.nome || ''} ${m.complemento || ''} ${m.descricao || ''}`.toUpperCase()
  ).join(' ');

  const patterns = [
    'CUMPRIMENTO DE SENTENÇA',
    'CUMPRIMENTO DE SENTENCA',
    'FASE DE CUMPRIMENTO',
    'INÍCIO DO CUMPRIMENTO',
    'INICIO DO CUMPRIMENTO',
    'EXECUÇÃO DE SENTENÇA',
    'EXECUCAO DE SENTENCA',
    'CUMPRIMENTO PROVISÓRIO'
  ];

  for (const p of patterns) {
    if (allText.includes(p)) {
      return { ativo: true, motivo: p };
    }
  }

  return { ativo: false, motivo: null };
}

/**
 * Detecta se houve atualização no tribunal após o último retorno do usuário.
 * REGRA LEXIS: Alerta somente se DataMov > Fim do dia do Retorno.
 * Se não houver data de movimento, não há alerta.
 */
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

  // Se nunca houve retorno, alerta se for recente (últimos 45 dias) para não poluir
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
      // Regra de Propósito: Só alerta se a movimentação for em dia posterior ao atendimento
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
