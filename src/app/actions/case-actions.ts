/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */

import { startOfDay, differenceInCalendarDays, parseISO } from 'date-fns';
import { sanitizeDateCell } from './csv-import-engine';

/**
 * LÓGICA JURÍDICA PURA — STATUS, RISCO, TRIBUNAL CNJ
 * Motor de processamento v450.0 Elite
 */

export type CaseStatus =
  | "Vencido"
  | "É Hoje"
  | "Atenção"
  | "No Prazo"
  | "Sem Prazo"
  | "Encerrado"
  | "Arquivado"
  | "Caso Crítico"
  | string; 

export type RiskLevel = "Crítico" | "Atenção" | "Normal";

export interface LegalCase {
  id: string;
  db_id?: string;
  cliente: string;
  protocolo: string;
  telefone?: string;
  advogado: string;
  escritorio: string;
  situacao: string;
  proximoPrazo: string;
  ultimoRetorno: string;
  observacao?: string;
  status: CaseStatus;
  risco: RiskLevel;
  diasFaltando?: number | null;
  statusManual: string;
  tribunal: string;
  linkConsulta: string;
  produtos?: string;
  statusInterno?: string;
  ultimaMovimentacao?: string;
  dataDistribuicao?: string;
  tipo?: string;
  atendente?: string;
  parecerIA?: string;
  riscoIA?: string;
}

export type CaseNote = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  color: string;
  updatedAt: string;
};

export function fixEncoding(text: string): string {
  if (!text) return "";
  try {
    return text
      .replace(/Ã‡/g, 'Ç').replace(/Ã§/g, 'ç')
      .replace(/Ã£/g, 'ã').replace(/Ã¡/g, 'á')
      .replace(/Ã©/g, 'é').replace(/Ã­/g, 'í')
      .replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú')
      .replace(/Âº/g, 'º').replace(/Âª/g, 'ª').replace(/Â/g, ''); 
  } catch (e) { return text; }
}

/**
 * Converte data DD/MM/YYYY para ISO YYYY-MM-DD
 */
export function formatDateToISO(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const raw = String(dateStr).trim();
  if (raw === "" || raw === "-" || raw === "—" || raw === "0" || raw === "00/00/0000") return null;
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parts = raw.split(/[\/\-\.\s,]+/).filter(p => p.length > 0);
  if (parts.length !== 3) return null;

  let day, month, year;
  if (parts[0].length === 4) { 
    [year, month, day] = parts; 
  } else {
    [day, month, year] = parts;
    if (year.length === 2) {
      const yNum = parseInt(year, 10);
      year = yNum > 50 ? `19${year}` : `20${year}`;
    }
  }
  
  const d = String(day).padStart(2, "0");
  const m = String(month).padStart(2, "0");
  const y = String(year);

  const yNum = parseInt(y);
  if (yNum < 1900 || yNum > 2100) return null;

  return `${y}-${m}-${d}`;
}

export function calcularDiasFaltando(proximoISO: string | null): number | null {
  if (!proximoISO) return null;
  try {
    const dataPrazo = startOfDay(parseISO(proximoISO));
    const hoje = startOfDay(new Date());
    return differenceInCalendarDays(dataPrazo, hoje);
  } catch { return null; }
}

export function calcularStatus(
  proximoRetorno: string | null | undefined, 
  situacao: string | null | undefined,
  alertLimit: number = 3
): CaseStatus {
  const sit = (situacao || "").toUpperCase();
  if (sit.includes("ENCERRADO") || sit.includes("ARQUIVADO") || sit.includes("EXTINTO") || sit.includes("SUSPENSO")) return "Arquivado";

  const iso = formatDateToISO(proximoRetorno);
  if (!iso) return "Sem Prazo";

  const dias = calcularDiasFaltando(iso);
  if (dias === null) return "Sem Prazo";
  if (dias < 0) return "Vencido";
  if (dias === 0) return "É Hoje";
  if (dias <= alertLimit) return "Atenção";
  return "No Prazo";
}

export function extrairTribunal(protocolo: string): { tribunal: string; link: string; } {
  if (!protocolo) return { tribunal: "Outros", link: "" };
  const original = protocolo.trim();
  
  const match = original.match(/\.(\d)\.(\d{2})\./);
  
  if (!match) return { tribunal: "Outros", link: `https://www.google.com/search?q=consulta+processo+judicial+${encodeURIComponent(original)}` };

  const ramo = match[1]; 
  const cod = match[2];

  if (ramo === '8') {
    const mapa: Record<string, string> = {
      '01': 'TJAC', '02': 'TJAL', '03': 'TJAP', '04': 'TJAM', '05': 'TJBA',
      '06': 'TJCE', '07': 'TJDF', '08': 'TJES', '09': 'TJGO', '10': 'TJMA',
      '11': 'TJMT', '12': 'TJMS', '13': 'TJMG', '14': 'TJPA', '15': 'TJPB',
      '16': 'TJPR', '17': 'TJPE', '18': 'TJPI', '19': 'TJRJ', '20': 'TJRN',
      '21': 'TJRS', '22': 'TJRO', '23': 'TJRR', '24': 'TJSC', '25': 'TJSE',
      '26': 'TJSP', '27': 'TJTO',
    };
    const trib = mapa[cod] || "Outros";
    return { tribunal: trib, link: `https://www.google.com/search?q=consulta+processo+${trib}+${encodeURIComponent(original)}` };
  }
  
  if (ramo === '4') return { tribunal: `TRF${cod}`, link: `https://www.google.com/search?q=consulta+processo+TRF${cod}+${encodeURIComponent(original)}` };

  return { tribunal: "Outros", link: `https://www.google.com/search?q=consulta+processo+judicial+${encodeURIComponent(original)}` };
}

export function processarCaso(raw: any, thresholds?: { alertLimit: number }): LegalCase {
  // Se já for um objeto canônico vindo do motor de importação, as chaves estarão em minúsculo
  const isCanonical = raw.protocolo !== undefined && raw.cliente !== undefined;
  
  let data: any = {};
  if (!isCanonical) {
    Object.keys(raw).forEach(k => {
      const cleanKey = k.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').trim();
      data[cleanKey] = raw[k];
    });
  } else {
    data = raw;
  }

  const cliente = fixEncoding(data.CLIENTE || data.cliente || 'NÃO IDENTIFICADO').toUpperCase();
  const protocolo = (data.PROTOCOLO || data.protocolo || '').trim();
  const advogado = fixEncoding(data.ADVOGADO || data.advogado || 'NÃO ATRIBUÍDO').toUpperCase();
  const escritorio = fixEncoding(data.ESCRITORIO || data.escritorio || '').trim().toUpperCase();
  const situacao = (data.SITUACAO || data.situacao || data.STATUS || 'EM ANDAMENTO').toUpperCase();
  
  const proximoPrazoRaw = sanitizeDateCell(data.PROXIMO_RETORNO || data.PROXIMO_PRAZO || data.proximoPrazo || '');
  const ultimoRetornoRaw = sanitizeDateCell(data.ULTIMO_RETORNO || data.RETORNO || data.ultimoRetorno || '');
  
  const statusManual = data.STATUS_MANUAL || data.statusManual || 'Automatico';

  const tribunalData = extrairTribunal(protocolo);
  const statusCalculado = calcularStatus(proximoPrazoRaw, situacao, thresholds?.alertLimit || 3);

  // Unificação de Observações + Produtos
  let observacao = fixEncoding(data.OBSERVACAO || data.OBSERVACOES || data.observacao || '');
  const produtos = data.PRODUTOS || data.produtos || '';
  if (produtos && !observacao.includes(produtos)) {
    observacao = `[PRODUTO: ${produtos}] ${observacao}`.trim();
  }

  return {
    id: raw.id || crypto.randomUUID(),
    cliente,
    protocolo,
    advogado,
    escritorio,
    situacao,
    proximoPrazo: proximoPrazoRaw, 
    ultimoRetorno: ultimoRetornoRaw,
    status: (statusManual === 'Automatico') ? statusCalculado : statusManual,
    risco: (statusCalculado === 'Vencido' || statusManual === 'Caso Crítico') ? "Crítico" : "Normal",
    diasFaltando: calcularDiasFaltando(formatDateToISO(proximoPrazoRaw)),
    statusManual,
    tribunal: tribunalData.tribunal,
    linkConsulta: tribunalData.link,
    observacao,
    telefone: (data.TELEFONE || data.telefone || '').replace(/\D/g, '')
  };
}
