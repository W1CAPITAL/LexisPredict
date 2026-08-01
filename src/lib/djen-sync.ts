/**
 * @fileOverview Sincronia de Comunicações DJEN v2.0
 * Compara publicações do diário oficial com o último retorno do cliente.
 * Utiliza o motor de resumos curtos para telemetria e notificações.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { startOfDay, parseISO, isAfter, subDays, parse, isValid } from 'date-fns';
import { DjenComunicacao, summarizeDjenKeywords, plainTextFromDjen } from './djen';

export interface DjenSyncResult {
  alerta: boolean;
  dataUltima: string | null;
  resumo: string | null;
  link: string | null;
}

export function detectarNovaComunicacaoDjen(
  ultimoRetornoStr: string | null | undefined,
  items: DjenComunicacao[]
): DjenSyncResult {
  if (!items || items.length === 0) {
    return { alerta: false, dataUltima: null, resumo: null, link: null };
  }

  // Ordenação por data de disponibilização DESC
  const sorted = [...items].sort((a, b) => {
    const dateA = a.data_disponibilizacao ? new Date(a.data_disponibilizacao).getTime() : 0;
    const dateB = b.data_disponibilizacao ? new Date(b.data_disponibilizacao).getTime() : 0;
    return dateB - dateA;
  });

  const ultima = sorted[0];
  const dataPub = ultima.data_disponibilizacao ? parseISO(ultima.data_disponibilizacao) : null;
  
  if (!dataPub) return { alerta: false, dataUltima: null, resumo: null, link: null };

  const dataUltimaStr = dataPub.toISOString();
  
  // MOTOR DE KEYWORDS v5.0 (Somente o essencial para filas e alertas)
  const resumo = summarizeDjenKeywords(ultima.texto) 
    || ultima.tipoComunicacao 
    || "PUBLICAÇÃO DJEN";

  // Se nunca houve retorno, alerta se for recente (últimos 30 dias)
  if (!ultimoRetornoStr || ultimoRetornoStr.trim() === "" || ultimoRetornoStr === "-" || ultimoRetornoStr === "0") {
    const trintaDias = startOfDay(subDays(new Date(), 30));
    return {
      alerta: isAfter(dataPub, trintaDias),
      dataUltima: dataUltimaStr,
      resumo,
      link: ultima.link
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
      // Alerta se a publicação for em dia posterior ao atendimento
      const fimDoDiaRetorno = new Date(dataRetorno);
      fimDoDiaRetorno.setHours(23, 59, 59, 999);

      return {
        alerta: isAfter(dataPub, fimDoDiaRetorno),
        dataUltima: dataUltimaStr,
        resumo,
        link: ultima.link
      };
    }
    return { alerta: false, dataUltima: dataUltimaStr, resumo, link: ultima.link };
  } catch (e) {
    return { alerta: false, dataUltima: dataUltimaStr, resumo, link: ultima.link };
  }
}
