
/**
 * @fileOverview Motor de Sincronia e Comparação de Datas DataJud v1.9
 * Agora com hashing de integridade para detectar mudanças reais de conteúdo.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { startOfDay, parseISO, isAfter, subDays, parse, isValid } from 'date-fns';

/**
 * Gera uma assinatura (hash) do estado atual das movimentações.
 * Focado nos 3 movimentos mais recentes para detectar mudanças reais de texto.
 */
export function gerarHashAuditoria(movimentos: any[]): string {
  if (!movimentos || movimentos.length === 0) return "EMPTY";
  
  // Ordenar decrescente por data para pegar os mais recentes
  const sorted = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  // Compor a string base com os 3 movimentos mais novos
  const signature = sorted.slice(0, 3)
    .map(m => `${m.dataHora || ''}|${m.nome || ''}`)
    .join('##');

  // Retorno de hash simplificado via base64 para o banco
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
  
  const window = sorted.slice(0, 20);

  const patternGroups = [
    {
      patterns: ['BAIXA DEFINITIVA', 'BAIXA DO PROCESSO', 'BAIXA DEFINITIVA DO FEITO', 'DETERMINADA A BAIXA', 'PROCESSO BAIXADO'],
      label: 'BAIXA DEFINITIVA'
    },
    {
      patterns: ['TRÂNSITO EM JULGADO', 'TRANSITO EM JULGADO'],
      label: 'TRÂNSITO EM JULGADO'
    },
    {
      patterns: ['EXTINTO O PROCESSO', 'EXTINTO POR ABANDONO', 'ABANDONO DA CAUSA', 'ABANDONO PELO AUTOR', 'EXTINTO O PROCESSO POR ABANDONO', 'JULGO EXTINTO', 'EXTINGO O PROCESSO', 'PROCESSO EXTINTO', 'SENTENÇA DE EXTINÇÃO', 'SENTENCA DE EXTINCAO'],
      label: 'EXTINÇÃO / ABANDONO'
    },
    {
      patterns: ['EXTINTO', 'EXTINÇÃO', 'EXTINCAO', 'EXTINÇÃO SEM RESOLUÇÃO', 'EXTINCAO SEM RESOLUCAO', 'SEM RESOLUÇÃO DO MÉRITO', 'SEM RESOLUCAO DO MERITO'],
      label: 'EXTINÇÃO DO FEITO'
    },
    {
      patterns: ['ARQUIVAMENTO DEFINITIVO', 'ARQUIVADO DEFINITIVAMENTE', 'ARQUIVEM-SE OS AUTOS', 'AUTOS ARQUIVADOS', 'ARQUIVAMENTO', 'ARQUIVADO', 'ARQUIV'],
      label: 'ARQUIVAMENTO DEFINITIVO'
    }
  ];

  const constructedWindow = window.map(mov => {
    const text = `${mov.nome || ''} ${mov.complemento || ''} ${mov.descricao || ''}`.toUpperCase();
    return { text };
  });

  for (const group of patternGroups) {
    for (const item of constructedWindow) {
      if (group.patterns.some(p => item.text.includes(p))) {
        return { encerrado: true, motivo: group.label };
      }
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

  const dataMovDay = startOfDay(dataMov);
  const dataUltimoStr = dataMov.toISOString();
  const nomeUltimo = lastMov.nome || "Movimentação não identificada";

  if (!ultimoRetornoStr || ultimoRetornoStr.trim() === "" || ultimoRetornoStr === "-") {
    const trintaDiasAtras = startOfDay(subDays(new Date(), 30));
    return {
      alerta: isAfter(dataMovDay, trintaDiasAtras),
      dataUltimo: dataUltimoStr,
      nomeUltimo
    };
  }

  try {
    let dataRetorno;
    const cleanStr = ultimoRetornoStr.trim();
    if (cleanStr.includes('-')) {
      dataRetorno = startOfDay(parseISO(cleanStr));
    } else if (cleanStr.includes('/')) {
      dataRetorno = startOfDay(parse(cleanStr, 'dd/MM/yyyy', new Date()));
    }

    if (dataRetorno && isValid(dataRetorno)) {
      return {
        alerta: isAfter(dataMovDay, dataRetorno),
        dataUltimo: dataUltimoStr,
        nomeUltimo
      };
    }
    return { alerta: false, dataUltimo: dataUltimoStr, nomeUltimo };
  } catch (e) {
    return { alerta: false, dataUltimo: dataUltimoStr, nomeUltimo };
  }
}
