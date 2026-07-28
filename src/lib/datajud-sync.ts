/**
 * @fileOverview Motor de Sincronia e Comparação de Datas DataJud v1.0
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { startOfDay, parseISO, isAfter, subDays, parse } from 'date-fns';

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

  // CASO 2: Existe último retorno (DD/MM/YYYY)
  try {
    const dataRetorno = startOfDay(parse(ultimoRetornoStr, 'dd/MM/yyyy', new Date()));
    return {
      alerta: isAfter(dataMovDay, dataRetorno),
      dataUltimo: dataUltimoStr,
      nomeUltimo
    };
  } catch (e) {
    // Fallback se a data estiver em formato inválido
    return { alerta: false, dataUltimo: dataUltimoStr, nomeUltimo };
  }
}
