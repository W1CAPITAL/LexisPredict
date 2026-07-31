/**
 * @fileOverview Motor de Sincronia e Comparação de Datas DataJud v2.0
 * Agora com hashing de integridade e detecção rigorosa de ritos de encerramento.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { startOfDay, parseISO, isAfter, subDays, parse, isValid, isBefore } from 'date-fns';

/**
 * Gera uma assinatura (hash) do estado atual das movimentações.
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
      patterns: ['BAIXA DEFINITIVA', 'BAIXA DO PROCESSO', 'BAIXA DEFINITIVA DO FEITO', 'DETERMINADA A BAIXA', 'PROCESSO BAIXADO', 'MANDADO DE LEVANTAMENTO EXPEDIDO'],
      label: 'BAIXA DEFINITIVA'
    },
    {
      patterns: ['TRÂNSITO EM JULGADO', 'TRANSITO EM JULGADO', 'CERTIFICADA A TRANSITO'],
      label: 'TRÂNSITO EM JULGADO'
    },
    {
      patterns: ['EXTINTO O PROCESSO', 'EXTINTO POR ABANDONO', 'ABANDONO DA CAUSA', 'EXTINTO O PROCESSO POR ABANDONO', 'JULGO EXTINTO', 'EXTINGO O PROCESSO', 'PROCESSO EXTINTO', 'SENTENÇA DE EXTINÇÃO', 'SENTENCA DE EXTINCAO', 'EXTINÇÃO DO PROCESSO'],
      label: 'EXTINÇÃO / ABANDONO'
    },
    {
      patterns: ['EXTINTO', 'EXTINÇÃO', 'EXTINCAO', 'SEM RESOLUÇÃO DO MÉRITO', 'SEM RESOLUCAO DO MERITO'],
      label: 'EXTINÇÃO DO FEITO'
    },
    {
      patterns: ['ARQUIVAMENTO DEFINITIVO', 'ARQUIVADO DEFINITIVAMENTE', 'ARQUIVEM-SE OS AUTOS', 'AUTOS ARQUIVADOS', 'ARQUIVAMENTO', 'ARQUIVADO'],
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
 * Detecta se houve atualização no tribunal após o último retorno do usuário.
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
  
  if (!dataMov) return { alerta: false, dataUltimo: null, nomeUltimo: null };

  const dataUltimoStr = dataMov.toISOString();
  const nomeUltimo = lastMov.nome || "Movimentação não identificada";

  // Se nunca houve retorno, marcamos como alerta se o movimento for recente (últimos 45 dias)
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
      // Comparação absoluta: Movimento é estritamente após o retorno?
      return {
        alerta: isAfter(dataMov, dataRetorno),
        dataUltimo: dataUltimoStr,
        nomeUltimo
      };
    }
    return { alerta: false, dataUltimo: dataUltimoStr, nomeUltimo };
  } catch (e) {
    return { alerta: false, dataUltimo: dataUltimoStr, nomeUltimo };
  }
}
