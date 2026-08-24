/**
 * Detecção de mérito (sentença / audiência) a partir de DataJud e DJEN.
 * Usado no scan e em métricas — não inventa resultado sem texto.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import type { EventoTipo } from './case-logic';
import { detectarAudienciaPendente } from './audiencia-detect';

const RE_AUDIENCIA =
  /AUDI[EÊ]NCIA|AUDIENCIA|CONCILIA[CÇ][AÃ]O|INSTRU[CÇ][AÃ]O|JULGAMENTO\s+DESIGNAD|SESS[AÃ]O\s+DE\s+JULGAMENTO/i;

const RE_PROCEDENTE =
  /\bPROCEDENTE\b(?!\s*EM\s*PARTE)|\bJULGO\s+PROCEDENTE\b|\bPEDIDO\s+PROCEDENTE\b/i;

const RE_IMPROCEDENTE =
  /\bIMPROCEDENTE\b|\bJULGO\s+IMPROCEDENTE\b|\bPEDIDO\s+IMPROCEDENTE\b/i;

const RE_PARCIAL = /PROCEDENTE\s+EM\s+PARTE|PARCIALMENTE\s+PROCEDENTE/i;

const RE_SENTENCA = /SENTEN[CÇ]A|AC[OÓ]RD[AÃ]O|DECIS[AÃ]O\s+DE\s+M[EÉ]RITO/i;

export type MeritoDetect = {
  eventoTipo: EventoTipo | null;
  resumo: string | null;
  isAudiencia: boolean;
  isProcedente: boolean;
  isImprocedente: boolean;
  isParcial: boolean;
};

function joinTexts(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' · ');
}

/** Classifica um bloco de texto (movimento DataJud ou publicação DJEN). */
export function classifyMeritoFromText(text: string | null | undefined): MeritoDetect {
  const t = (text || '').trim();
  if (!t) {
    return {
      eventoTipo: null,
      resumo: null,
      isAudiencia: false,
      isProcedente: false,
      isImprocedente: false,
      isParcial: false,
    };
  }

  const aud = detectarAudienciaPendente(t);
  const isAudiencia = aud.isAudienciaPendente;
  const isParcial = RE_PARCIAL.test(t);
  const isProcedente = !isParcial && RE_PROCEDENTE.test(t);
  const isImprocedente = !isParcial && RE_IMPROCEDENTE.test(t);
  const hasSentenca = RE_SENTENCA.test(t) || isProcedente || isImprocedente || isParcial;

  let eventoTipo: EventoTipo | null = null;
  if (isAudiencia) {
    eventoTipo = (aud.tipo as EventoTipo) || 'audiencia_julgamento';
  } else if (isParcial) eventoTipo = 'sentenca_parcial';
  else if (isProcedente) eventoTipo = 'sentenca_procedente';
  else if (isImprocedente) eventoTipo = 'sentenca_improcedente';
  else if (hasSentenca) eventoTipo = 'sentenca_parcial'; // genérico de mérito sem polaridade clara

  return {
    eventoTipo,
    resumo: t.slice(0, 220),
    isAudiencia,
    isProcedente,
    isImprocedente,
    isParcial,
  };
}

/**
 * Agrega movimentos DataJud + itens DJEN e escolhe o mérito mais forte.
 * Pesos: improcedente/procedente > parcial > audiência.
 */
export function detectMeritoFromSources(input: {
  movimentos?: Array<{ nome?: string; complemento?: string; descricao?: string; dataHora?: string }>;
  comunicacoes?: Array<{ texto?: string; data_disponibilizacao?: string | null }>;
  ultimoRetorno?: string | null;
}): MeritoDetect & { dataEvento: string | null; aposRetorno: boolean } {
  const chunks: Array<{ text: string; data: string | null }> = [];

  for (const m of input.movimentos || []) {
    chunks.push({
      text: joinTexts([m.nome, m.complemento, m.descricao]),
      data: m.dataHora || null,
    });
  }
  for (const c of input.comunicacoes || []) {
    chunks.push({
      text: c.texto || '',
      data: c.data_disponibilizacao || null,
    });
  }

  let best: MeritoDetect = classifyMeritoFromText('');
  let dataEvento: string | null = null;
  let bestWeight = -1;

  const weight = (d: MeritoDetect) => {
    if (d.isImprocedente || d.isProcedente) return 90;
    if (d.isParcial) return 80;
    if (d.isAudiencia) return 70;
    if (d.eventoTipo) return 40;
    return 0;
  };

  for (const ch of chunks) {
    const d = classifyMeritoFromText(ch.text);
    const w = weight(d);
    if (w > bestWeight) {
      bestWeight = w;
      best = d;
      dataEvento = ch.data;
    }
  }

  const aposRetorno = isDataAposRetorno(dataEvento, input.ultimoRetorno);

  return { ...best, dataEvento, aposRetorno };
}

export function isDataAposRetorno(
  dataEvento: string | null | undefined,
  ultimoRetorno: string | null | undefined
): boolean {
  if (!dataEvento) return false;
  if (!ultimoRetorno || !String(ultimoRetorno).trim()) return true;
  try {
    const e = new Date(dataEvento.includes('/') ? dataEvento.split('/').reverse().join('-') : dataEvento);
    const rRaw = String(ultimoRetorno).trim();
    const r = new Date(rRaw.includes('/') ? rRaw.split('/').reverse().join('-') : rRaw);
    if (Number.isNaN(e.getTime()) || Number.isNaN(r.getTime())) return true;
    // mesmo dia conta como pós-retorno (atendimento não cobre movimento do dia)
    const e0 = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
    const r0 = new Date(r.getFullYear(), r.getMonth(), r.getDate()).getTime();
    return e0 >= r0;
  } catch {
    return true;
  }
}

/** Caso com audiência após último retorno (para dashboard / score). */
export function hasAudienciaPosRetorno(c: {
  evento_tipo?: string | null;
  evento_data?: string | null;
  datajud_ultimo_movimento?: string | null;
  djen_ultima_data?: string | null;
  ultimoRetorno?: string | null;
  evento_resumo?: string | null;
  datajud_ultimo_nome?: string | null;
  djen_ultimo_resumo?: string | null;
}): boolean {
  if (c.evento_tipo?.startsWith('audiencia')) {
    return isDataAposRetorno(
      c.evento_data || c.datajud_ultimo_movimento || c.djen_ultima_data,
      c.ultimoRetorno
    );
  }
  const text = `${c.evento_resumo || ''} ${c.datajud_ultimo_nome || ''} ${c.djen_ultimo_resumo || ''}`;
  if (!detectarAudienciaPendente(text).isAudienciaPendente) return false;
  return isDataAposRetorno(
    c.evento_data || c.datajud_ultimo_movimento || c.djen_ultima_data,
    c.ultimoRetorno
  );
}

/**
 * Procedente alinhado ao scanner / aba Ações Procedentes.
 * Não usar só evento_tipo — a maioria dos casos grava is_procedente no scan DataJud/DJEN.
 */
export function isSentencaProcedente(c: {
  evento_tipo?: string | null;
  is_procedente?: boolean | null;
  dados?: any;
  status_executivo?: string | null;
  [k: string]: any;
}): boolean {
  if (!c) return false;
  const ev = String(c.evento_tipo || '');
  if (ev === 'sentenca_procedente' || ev === 'sentenca_parcial') return true;
  if (c.is_procedente === true) return true;
  const dados = c.dados && typeof c.dados === 'object' ? c.dados : {};
  if (dados.is_procedente === true) return true;
  const st =
    c.status_executivo ||
    dados.status_executivo ||
    (c as any).detalhes_execucao?.status_executivo ||
    dados.detalhes_execucao?.status_executivo;
  if (String(st) === 'procedente') return true;
  return false;
}

export function isSentencaImprocedente(c: {
  evento_tipo?: string | null;
  is_improcedente?: boolean | null;
  dados?: any;
  [k: string]: any;
}): boolean {
  if (!c) return false;
  if (c.evento_tipo === 'sentenca_improcedente') return true;
  if (c.is_improcedente === true) return true;
  const dados = c.dados && typeof c.dados === 'object' ? c.dados : {};
  if (dados.is_improcedente === true) return true;
  // evita marcar procedente e improcedente juntos
  if (isSentencaProcedente(c)) return false;
  return false;
}
