import type { ProcessTimelineSource } from '@/lib/processos-timeline';

/**
 * Recupera evidências de consultas Hermes anteriores quando uma fonte oficial
 * não respondeu AGORA. Não apresenta um cache como confirmação atual.
 * O caller informa quais fontes da consulta corrente realmente responderam.
 */
export function recoverHermesTimelineSource(
  rawCnj: string,
  storedEvents: unknown,
  current: { datajudOk: boolean; djenOk: boolean },
): { source: ProcessTimelineSource; datajudCount: number; djenCount: number } | null {
  const cnj = String(rawCnj || '').replace(/\D/g, '');
  if (cnj.length !== 20 || !Array.isArray(storedEvents)) return null;
  if (current.datajudOk && current.djenOk) return null;

  const movimentos: Array<{ dataHora: string; nome: string; complemento: string }> = [];
  const comunicacoes: Array<{ data_disponibilizacao: string; texto: string; tipoComunicacao: string; link?: string }> = [];
  const unique = new Set<string>();

  for (const raw of storedEvents.slice(0, 250)) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;
    const source = e.source;
    if (source !== 'DataJud' && source !== 'DJEN') continue;
    if ((source === 'DataJud' && current.datajudOk) || (source === 'DJEN' && current.djenOk)) continue;

    const at = String(e.at || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(at) || Number.isNaN(Date.parse(`${at}T12:00:00Z`)) ||
        new Date(`${at}T12:00:00Z`).toISOString().slice(0, 10) !== at) continue;
    const value = String(e.text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2400);
    if (!value) continue;
    const id = `${source}|${at}|${value.toLocaleLowerCase('pt-BR')}`;
    if (unique.has(id)) continue;
    unique.add(id);

    if (source === 'DataJud') {
      movimentos.push({ dataHora: at, nome: value, complemento: 'Histórico Hermes salvo; fonte não revalidada nesta consulta.' });
    } else {
      let link: string | undefined;
      try {
        const url = new URL(String(e.url || ''));
        if (url.protocol === 'https:' && (url.hostname === 'jus.br' || url.hostname.endsWith('.jus.br'))) link = url.href;
      } catch { /* nenhum endereço é inventado */ }
      comunicacoes.push({ data_disponibilizacao: at, texto: value, tipoComunicacao: 'Publicação DJEN (histórico Hermes)', ...(link ? { link } : {}) });
    }
  }

  if (!movimentos.length && !comunicacoes.length) return null;
  return {
    source: { cnj, movimentos, comunicacoes },
    datajudCount: movimentos.length,
    djenCount: comunicacoes.length,
  };
}
