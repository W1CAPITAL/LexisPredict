/**
 * @fileOverview Motor de Sincronia e Comparação de Datas DataJud v1.1
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { startOfDay, parseISO, isAfter, subDays, parse, isValid } from 'date-fns';

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

  // Analisar os 5 movimentos mais recentes (dataHora DESC)
  const sorted = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );
  
  const recentMovs = sorted.slice(0, 5);

  const keywords = [
    'ARQUIV', 'BAIXA DEFINITIVA', 'BAIXADO', 'EXTINTO', 'EXTINCAO', 'EXTINÇÃO',
    'TRANSITO EM JULGADO', 'TRÂNSITO EM JULGADO',
    'CANCELAMENTO DA DISTRIBUICAO', 'CANCELAMENTO DA DISTRIBUIÇÃO', 'CANCELADA A DISTRIBUIÇÃO',
    'SEM RESOLUÇÃO DO MÉRITO', 'SEM RESOLUCAO DO MERITO',
    'HOMOLOGAÇÃO DE DESISTÊNCIA', 'HOMOLOGACAO DE DESISTENCIA'
  ];

  for (const mov of recentMovs) {
    const texto = `${mov.nome || ''} ${mov.complemento || ''} ${mov.descricao || ''}`.toUpperCase();
    
    // Verificação de match por palavra-chave
    const match = keywords.find(k => texto.includes(k));
    
    if (match) {
      // Regra especial: Baixa Provisória sozinha não encerra, precisa de Arquiv/Extinto
      if (texto.includes('PROVISÓRIA') || texto.includes('PROVISORIA')) {
        if (texto.includes('ARQUIV') || texto.includes('EXTINTO')) {
          return { encerrado: true, motivo: match };
        }
        continue;
      }
      return { encerrado: true, motivo: match };
    }
  }

  return { encerrado: false, motivo: null };
}

/**
 * Detecta se houve atualização no tribunal após o último retorno do usuário.
 * Suporta formatos de data DD/MM/YYYY e ISO.
 */
export function detectarAtualizacaoPosRetorno(
  ultimoRetornoStr: string | null | undefined,
  movimentos: any[]
): { alerta: boolean; dataUltimo: string | null; nomeUltimo: string | null } {
  if (!movimentos || movimentos.length === 0) {
    return { alerta: false, dataUltimo: null, nomeUltimo: null };
  }

  // Obter movimento mais recente
  const sorted = [...movimentos].sort((a, b) => 
    new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
  );
  
  const lastMov = sorted[0];
  const dataMov = lastMov.dataHora ? parseISO(lastMov.dataHora) : null;
  
  if (!dataMov) return { alerta: false, dataUltimo: null, nomeUltimo: null };

  const dataMovDay = startOfDay(dataMov);
  const dataUltimoStr = dataMov.toISOString();
  const nomeUltimo = lastMov.nome || "Movimentação não identificada";

  // CASO 1: Não existe último retorno cadastrado
  if (!ultimoRetornoStr || ultimoRetornoStr.trim() === "" || ultimoRetornoStr === "-") {
    // Alerta se o movimento for dos últimos 30 dias
    const trintaDiasAtras = startOfDay(subDays(new Date(), 30));
    return {
      alerta: isAfter(dataMovDay, trintaDiasAtras),
      dataUltimo: dataUltimoStr,
      nomeUltimo
    };
  }

  // CASO 2: Existe último retorno - Tratamento Resiliente de Formato
  try {
    let dataRetorno;
    const cleanStr = ultimoRetornoStr.trim();
    
    if (cleanStr.includes('-')) {
      // Padrão ISO YYYY-MM-DD
      dataRetorno = startOfDay(parseISO(cleanStr));
    } else if (cleanStr.includes('/')) {
      // Padrão BR DD/MM/YYYY
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
