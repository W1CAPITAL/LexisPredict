/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */

import { startOfDay, differenceInCalendarDays, parseISO } from 'date-fns';
import { diasAtePrazo, statusPorPrazo, normalizarDataPrazo, hojeBrasilISO } from './prazo-status';
import { sanitizeDateCell } from './csv-import-engine';
import { isCasoEncerrado as isCasoEncerradoCore } from './status-encerrado';

/**
 * LÓGICA JURÍDICA PURA — STATUS, RISCO, TRIBUNAL CNJ
 * Motor de processamento v500.0 Elite - UNIFICADO
 */


/** Remove tags legadas de BA e limpa resumos poluídos. */
export function sanitizeEventoResumo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  // Remove tags BA isoladas / legadas
  s = s.replace(/\bB\.?\s*A\.?\b/gi, '');
  s = s.replace(/\bBUSCA\s+E\s+APREENS[AÃ]O\b/gi, '');
  s = s.replace(/ALERTA:\s*/gi, '');
  // Limpa separadores órfãos
  s = s.replace(/\s*\|\s*/g, ' | ').replace(/^\s*\|\s*|\s*\|\s*$/g, '').replace(/(\s*\|\s*){2,}/g, ' | ').trim();
  s = s.replace(/^\|\s*|\s*\|$/g, '').trim();
  if (!s || s === '|' || /^\|+$/.test(s)) return null;
  return s;
}

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

export type EventoTipo = 
  | 'ba' 
  | 'audiencia_conciliacao'
  | 'audiencia_instrucao'
  | 'audiencia_julgamento'
  | 'sentenca_procedente' 
  | 'sentenca_improcedente' 
  | 'sentenca_parcial' 
  | 'cumprimento_sentenca' 
  | 'transito_ou_baixa' 
  | 'transito_baixa'
  | 'cancelamento_distribuicao' 
  | 'liminar'
  | 'novo_andamento_relevante' 
  | 'rotina';

export interface LegalCase {
  id: string;
  db_id?: string;
  created_by?: string;
  cliente: string;
  protocolo: string;
  telefone?: string;
  cpf?: string;
  email?: string;
  estado_civil?: string;
  emprego?: string;
  nacionalidade?: string;
  parte_passiva?: string;
  parte_passiva_cnpj?: string;
  classe_acao?: string;
  orgao_julgador?: string;
  advogado: string;
  escritorio: string;
  situacao: string;
  proximoPrazo: string;
  ultimoRetorno: string;
  /** YYYY-MM-DD — última edição no app (KPI Editados) */
  auditado_em?: string | null;
  auditado_por?: string | null;
  /** quem registrou atendimento/encerramento */
  atendido_por?: string | null;
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
  
  // EVENTO UNIFICADO (DataJud + DJEN)
  tem_novo_andamento?: boolean;
  evento_tipo?: EventoTipo;
  evento_resumo?: string | null;
  evento_data?: string | null;
  evento_fonte?: 'datajud' | 'djen' | 'ambos';

  // Auditoria DataJud (Campos Técnicos)
  datajud_ultimo_movimento?: string | null;
  datajud_ultimo_nome?: string | null;
  datajud_consultado_em?: string | null;
  tem_atualizacao_pos_retorno?: boolean; 
  datajud_encerrado_tribunal?: boolean; 
  datajud_encerrado_motivo?: string | null;
  datajud_hash?: string | null;

  // Auditoria Busca e Apreensão (BA)
  indicio_busca_apreensao?: boolean;
  busca_apreensao_confianca?: 'alta' | 'media' | 'baixa' | null;
  busca_apreensao_motivo?: string | null;
  busca_apreensao_consultado_em?: string | null;

  // Fase Executiva
  em_cumprimento_sentenca?: boolean;
  cumprimento_sentenca_motivo?: string | null;
  cumprimento_sentenca_consultado_em?: string | null;

  // Auditoria DJEN
  djen_consultado_em?: string | null;
  djen_nova_comunicacao?: boolean;
  djen_ultima_data?: string | null;
  djen_ultimo_resumo?: string | null;
  djen_ultimo_link?: string | null;
  djen_count?: number;

  // Auditoria de edição
  edited_by?: string;
  edited_at?: string;
  edited_by_name?: string;
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
      .replace(/Ã©/g, 'é').replace(/Ã\u00ad/g, 'í')
      .replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú')
      .replace(/Âº/g, 'º').replace(/Âª/g, 'ª').replace(/Â/g, ''); 
  } catch (e) { return text; }
}

export function formatDateToISO(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const raw = String(dateStr).trim();
  if (raw === "" || raw === "-" || raw === "—" || raw === "0" || raw === "00/00/0000") return null;
  if (raw.includes('#')) return null;

  if (/^\d{5}(\.\d+)?$/.test(raw)) {
    const n = Math.floor(Number(raw));
    if (n >= 20000 && n <= 80000) {
      const utc = Date.UTC(1899, 11, 30) + n * 86400000;
      const d = new Date(utc);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      if (y >= 1950 && y <= 2110) return `${y}-${m}-${day}`;
    }
  }

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

  return `${y}-${m}-${d}`;
}

export function calcularDiasFaltando(proximoISO: string | null): number | null {
  // Sempre via calendário de Brasília (não UTC do servidor Vercel)
  return diasAtePrazo(proximoISO);
}

export function isCasoEncerrado(c: any): boolean {
  return isCasoEncerradoCore(c);
}

export function calcularStatus(
  proximoRetorno: string | null | undefined, 
  situacao: string | null | undefined,
  alertLimit: number = 3
): CaseStatus {
  return statusPorPrazo(proximoRetorno, { situacao, alertLimit });
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
      '11': 'TJMT', '12': 'TJMS', '13': 'TJMG', '14': 'Tjpa', '15': 'TJPB',
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
  
  const proximoPrazoRaw = sanitizeDateCell(
    data.PROXIMO_RETORNO || data.PROXIMO_PRAZO || data.proximoPrazo || data.proximo_retorno || data.proximo_prazo || ''
  );
  const ultimoRetornoRaw = sanitizeDateCell(
    data.ULTIMO_RETORNO || data.RETORNO || data.ultimoRetorno || data.ultimo_retorno || data.ultimo_atendimento || ''
  );
  
  const statusManual = data.STATUS_MANUAL || data.statusManual || 'Automatico';

  const tribunalData = extrairTribunal(protocolo);
  const statusCalculado = calcularStatus(proximoPrazoRaw, situacao, thresholds?.alertLimit || 3);

  let observacao = fixEncoding(data.OBSERVACAO || data.OBSERVACOES || data.observacao || '');
  const produtos = data.PRODUTOS || data.produtos || '';
  if (produtos && !observacao.includes(produtos)) {
    observacao = `[PRODUTO: ${produtos}] ${observacao}`.trim();
  }

  const toBool = (val: any) => {
    if (val === true || val === 'true' || val === 1 || val === '1') return true;
    return false;
  };

  // UNIFICAÇÃO DE FLAG: tem_novo_andamento é um alias para qualquer novidade não atendida
  const temAndamentoDataJud = toBool(data.tem_atualizacao_pos_retorno);
  const temAndamentoDjen = toBool(data.djen_nova_comunicacao);
  const novidadeUnificada = temAndamentoDataJud || temAndamentoDjen || toBool(data.tem_novo_andamento);

  return {
    id: raw.id || crypto.randomUUID(),
    created_by: data.created_by,
    cliente,
    protocolo,
    advogado,
    escritorio,
    situacao,
    proximoPrazo: proximoPrazoRaw, 
    ultimoRetorno: ultimoRetornoRaw,
    status: (statusManual === 'Automatico' || ['Vencido','É Hoje','Atenção','No Prazo','Sem Prazo'].includes(String(statusManual)))
      ? statusCalculado
      : statusManual,
    risco: (statusCalculado === 'Vencido' || statusManual === 'Caso Crítico') ? "Crítico" : "Normal",
    diasFaltando: calcularDiasFaltando(formatDateToISO(proximoPrazoRaw)),
    statusManual,
    tribunal: tribunalData.tribunal,
    linkConsulta: tribunalData.link,
    observacao,
    telefone: (data.TELEFONE || data.telefone || '').replace(/\D/g, ''),
    cpf: String(data.CPF || data.cpf || '').replace(/\D/g, '') || undefined,
    email: String(data.EMAIL || data.email || '').trim().toLowerCase() || undefined,
    estado_civil: fixEncoding(data.ESTADO_CIVIL || data.estado_civil || '').toUpperCase() || undefined,
    emprego: fixEncoding(data.EMPREGO || data.PROFISSAO || data.emprego || data.profissao || '').toUpperCase() || undefined,
    nacionalidade: fixEncoding(data.NACIONALIDADE || data.nacionalidade || 'BRASILEIRA').toUpperCase() || 'BRASILEIRA',
    parte_passiva: fixEncoding(data.PARTE_PASSIVA || data.parte_passiva || data.REU || data.reu || '').toUpperCase() || undefined,
    parte_passiva_cnpj: String(data.PARTE_PASSIVA_CNPJ || data.parte_passiva_cnpj || data.CNPJ_PASSIVO || '').replace(/\D/g, '') || undefined,
    classe_acao: fixEncoding(data.CLASSE_ACAO || data.classe_acao || data.CLASSE || data.classe || data.tipo || '').toUpperCase() || undefined,
    orgao_julgador: fixEncoding(data.ORGAO_JULGADOR || data.orgao_julgador || '').toUpperCase() || undefined,
    
    // EVENTO UNIFICADO
    tem_novo_andamento: novidadeUnificada,
    evento_tipo: data.evento_tipo === "ba" ? (toBool(data.datajud_encerrado_tribunal) ? "transito_ou_baixa" : "rotina") : data.evento_tipo,
    evento_resumo: sanitizeEventoResumo(data.evento_resumo),
    evento_data: data.evento_data,
    evento_fonte: data.evento_fonte,

    datajud_ultimo_movimento: data.datajud_ultimo_movimento,
    datajud_ultimo_nome: data.datajud_ultimo_nome,
    datajud_consultado_em: data.datajud_consultado_em,
    tem_atualizacao_pos_retorno: temAndamentoDataJud,
    datajud_encerrado_tribunal: toBool(data.datajud_encerrado_tribunal),
    datajud_encerrado_motivo: data.datajud_encerrado_motivo,
    datajud_hash: data.datajud_hash || null,

    indicio_busca_apreensao: false, // BA desativado — nunca expõe flag legado
    busca_apreensao_confianca: data.busca_apreensao_confianca,
    busca_apreensao_motivo: data.busca_apreensao_motivo,
    busca_apreensao_consultado_em: data.busca_apreensao_consultado_em,

    em_cumprimento_sentenca: toBool(data.em_cumprimento_sentenca),
    cumprimento_sentenca_motivo: data.cumprimento_sentenca_motivo,
    cumprimento_sentenca_consultado_em: data.cumprimento_sentenca_consultado_em,

    // DJEN
    djen_consultado_em: data.djen_consultado_em,
    djen_nova_comunicacao: temAndamentoDjen,
    djen_ultima_data: data.djen_ultima_data,
    djen_ultimo_resumo: sanitizeEventoResumo(data.djen_ultimo_resumo),
    djen_ultimo_link: data.djen_ultimo_link,
    djen_count: data.djen_count ? Number(data.djen_count) : 0,

    // KPI edição / atendimento (NÃO descartar no processarCaso)
    auditado_em: data.auditado_em ?? data.auditadoEm ?? null,
    auditado_por: data.auditado_por ?? data.auditadoPor ?? null,
    atendido_por: data.atendido_por ?? data.atendidoPor ?? null,
  };
}