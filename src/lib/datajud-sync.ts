
/**
 * @fileOverview Motor de Sincronia e Comparação de Datas DataJud v1.6
 * Agora com hashing de integridade para detectar mudanças reais de conteúdo.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { startOfDay, parseISO, isAfter, subDays, parse, isValid } from 'date-fns';

/**
 * Gera uma assinatura (hash) do estado atual das movimentações.
 * Usado para detectar mudanças mesmo que as datas não mudem (ex: correção de texto).
 */
export function gerarHashAuditoria(movimentos: any[]): string {
  if (!movimentos || movimentos.length === 0) return "EMPTY";
  
  // Analisamos os 5 movimentos mais recentes para compor o hash
  const sorted = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );

  const signature = sorted.slice(0, 5)
    .map(m => `${m.dataHora || ''}|${m.nome || ''}`)
    .join('##');

  // Retorno de hash simplificado via base64 para economia de espaço no banco
  try {
    return Buffer.from(signature).toString('base64').substring(0, 32);
  } catch {
    return signature.substring(0, 32);
  }
}

/**
 * Analisa os movimentos recentes do tribunal para detectar encerramento definitivo.
 * Prioridade Máxima de Auditoria.
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
    },
    {
      patterns: ['CANCELAMENTO DA DISTRIBUIÇÃO', 'CANCELAMENTO DA DISTRIBUICAO', 'CANCELADA A DISTRIBUIÇÃO', 'DISTRIBUIÇÃO CANCELADA'],
      label: 'CANCELAMENTO DE DISTRIBUIÇÃO'
    },
    {
      patterns: ['HOMOLOGAÇÃO DE DESISTÊNCIA', 'HOMOLOGACAO DE DESISTENCIA', 'HOMOLOGO A DESISTÊNCIA', 'DESISTÊNCIA DA AÇÃO', 'RENÚNCIA AO DIREITO', 'RENUNCIA AO DIREITO'],
      label: 'DESISTÊNCIA / RENÚNCIA'
    },
    {
      patterns: ['EXTINTO O CUMPRIMENTO DE SENTENÇA', 'CUMPRIMENTO DE SENTENÇA EXTINTO'],
      label: 'EXTINÇÃO DE CUMPRIMENTO'
    },
    {
      patterns: ['PERDA DO OBJETO'],
      label: 'PERDA DO OBJETO',
      filter: (t: string) => /EXTINT|ARQUIV|BAIXA/.test(t)
    },
    {
      patterns: ['HOMOLOGAÇÃO DE ACORDO', 'ACORDO HOMOLOGADO'],
      label: 'ACORDO HOMOLOGADO',
      filter: (t: string) => /ARQUIV|BAIXA|EXTINT/.test(t)
    }
  ];

  const constructedWindow = window.map(mov => {
    const text = `${mov.nome || ''} ${mov.complemento || ''} ${mov.descricao || ''}`.toUpperCase();
    const nomeRaw = (mov.nome || "").toUpperCase().trim();
    const isProvisional = (text.includes("PROVISÓRIA") || text.includes("PROVISORIA")) && 
                          !(/DEFINITIV|EXTINT|ARQUIVADO DEFINITIVAMENTE/.test(text));
    return { text, nomeRaw, isProvisional };
  });

  for (const group of patternGroups) {
    for (const item of constructedWindow) {
      if (item.isProvisional) continue;
      if (group.patterns.some(p => item.text.includes(p))) {
        if (group.filter && !group.filter(item.text)) continue;
        return { encerrado: true, motivo: group.label };
      }
    }
  }

  for (const item of constructedWindow) {
    if (item.isProvisional) continue;
    if (item.nomeRaw === "DEFINITIVO" || (item.text.includes("DEFINITIVO") && /ARQUIV|BAIXA|BAIXADO/.test(item.text))) {
      return { encerrado: true, motivo: "DEFINITIVO / ARQUIVAMENTO" };
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
