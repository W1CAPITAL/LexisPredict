/**
 * Server Actions — Varredura Busca e Apreensão (DJEN)
 * Isolado: não altera scanner DataJud / case-actions de lote.
 */
'use server';

import { getUserContext, getStoredCasesForEmpresa, listAdvogadosBanca } from '@/lib/server-db';
import { fetchDjenPorTexto } from '@/lib/djen-busca-texto';
import { fetchDjenComunicacoes } from '@/lib/djen';
import {
  textoIndicaBuscaApreensao,
  cruzarPublicacaoComCarteira,
  type MatchResult,
} from '@/lib/busca-apreensao-logic';

export interface BaHit {
  id: string;
  data: string | null;
  tribunal: string | null;
  orgao: string | null;
  processo: string | null;
  trecho: string;
  motivoBa: string;
  link: string | null;
  matches: MatchResult[];
  fonte: 'teor_djen' | 'carteira_cnj';
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 1) Busca no DJEN por teor "busca e apreensão" / "busca e apreensao"
 * 2) Filtra só itens que realmente indicam BA
 * 3) Cruza com clientes da carteira + advogados da banca + advogado do processo
 */
export async function runBuscaApreensaoDjenAction(opts?: {
  dias?: number;
  pagina?: number;
  /** também varre até N processos ativos da carteira no DJEN por CNJ */
  varreduraCarteira?: boolean;
  limiteCarteira?: number;
}) {
  try {
    const ctx = await getUserContext();
    const empresa_id = ctx?.empresa_id;
    if (!empresa_id) {
      return { success: false as const, error: 'Sessão expirada.', hits: [] as BaHit[] };
    }

    const dias = Math.min(Math.max(opts?.dias ?? 30, 1), 90);
    const dataInicio = daysAgoIso(dias);
    const dataFim = todayIso();

    const cases = (await getStoredCasesForEmpresa(empresa_id)) || [];
    const advs = (await listAdvogadosBanca()) || [];

    const clientes = cases
      .map((c: any) => ({
        nome: String(c.cliente || c.nome || ''),
        protocolo: String(c.protocolo || c.protocolo_ref || ''),
      }))
      .filter((c) => c.nome.length >= 6);

    const advogadosBanca = advs
      .map((a: any) => String(a.nome || a.name || ''))
      .filter((n) => n.length >= 6);

    const advogadosProcesso = cases
      .map((c: any) => ({
        nome: String(c.advogado || c.advogado_responsavel || ''),
        protocolo: String(c.protocolo || c.protocolo_ref || ''),
      }))
      .filter((a) => a.nome.length >= 6);

    const hits: BaHit[] = [];
    const seen = new Set<string>();

    const pushHit = (h: BaHit) => {
      const key = `${h.processo || ''}|${h.data || ''}|${h.motivoBa}|${h.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      hits.push(h);
    };

    // --- Busca por teor (duas grafias) ---
    const queries = ['busca e apreensão', 'busca e apreensao', 'mandado de busca e apreensão'];
    for (const q of queries) {
      const res = await fetchDjenPorTexto(q, {
        dataInicio,
        dataFim,
        pagina: opts?.pagina || 1,
        itensPorPagina: 50,
      });
      if (!res.success) {
        if (res.isGeoBlocked || res.isRateLimited) {
          return {
            success: false as const,
            error: res.error || 'Falha DJEN',
            hits,
            geoBlocked: !!res.isGeoBlocked,
            rateLimited: !!res.isRateLimited,
          };
        }
        continue;
      }
      for (const item of res.items) {
        const det = textoIndicaBuscaApreensao(item.texto);
        if (!det.hit) continue;
        const matches = cruzarPublicacaoComCarteira(item.texto || '', {
          clientes,
          advogadosBanca,
          advogadosProcesso,
        });
        // Só lista se cruzou com carteira/banca OU se o usuário quiser ver tudo
        // Regra: prioriza matches; se não houver match, ainda inclui com matches=[]
        // para o operador filtrar na UI "só da banca"
        pushHit({
          id: String(item.id),
          data: item.data_disponibilizacao,
          tribunal: item.siglaTribunal,
          orgao: item.nomeOrgao,
          processo: item.numero_processo,
          trecho: (item.texto || '').slice(0, 500),
          motivoBa: det.motivo || 'BUSCA E APREENSÃO',
          link: item.link,
          matches,
          fonte: 'teor_djen',
        });
      }
    }

    // --- Varredura opcional da carteira (CNJ a CNJ, lote pequeno) ---
    if (opts?.varreduraCarteira) {
      const limite = Math.min(opts?.limiteCarteira ?? 25, 40);
      const ativos = cases
        .filter((c: any) => {
          const st = String(c.status || c.situacao || '').toUpperCase();
          return !/(ENCERRADO|ARQUIVADO|BAIXA)/.test(st);
        })
        .slice(0, limite);

      for (const c of ativos) {
        const proto = String(c.protocolo || c.protocolo_ref || '');
        if (!proto) continue;
        const res = await fetchDjenComunicacoes(proto, {
          dataInicio,
          dataFim,
        });
        if (!res.success) continue;
        for (const item of res.items) {
          const det = textoIndicaBuscaApreensao(item.texto);
          if (!det.hit) continue;
          const matches = cruzarPublicacaoComCarteira(item.texto || '', {
            clientes,
            advogadosBanca,
            advogadosProcesso,
          });
          // Garante ao menos match pelo cliente do processo
          if (c.cliente && !matches.some((m) => m.tipo === 'cliente')) {
            matches.unshift({
              tipo: 'cliente',
              nome: String(c.cliente),
              protocolo: proto,
            });
          }
          pushHit({
            id: String(item.id) + '-c-' + proto,
            data: item.data_disponibilizacao,
            tribunal: item.siglaTribunal,
            orgao: item.nomeOrgao,
            processo: item.numero_processo || proto,
            trecho: (item.texto || '').slice(0, 500),
            motivoBa: det.motivo || 'BUSCA E APREENSÃO',
            link: item.link,
            matches,
            fonte: 'carteira_cnj',
          });
        }
      }
    }

    // Ordena: com match na banca/carteira primeiro
    hits.sort((a, b) => {
      const sa = a.matches.length ? 0 : 1;
      const sb = b.matches.length ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return String(b.data || '').localeCompare(String(a.data || ''));
    });

    return {
      success: true as const,
      hits,
      scannedQueries: queries.length,
      carteiraSize: cases.length,
      bancaSize: advogadosBanca.length,
      periodo: { dataInicio, dataFim },
    };
  } catch (e: any) {
    return {
      success: false as const,
      error: e?.message || 'Falha na varredura BA',
      hits: [] as BaHit[],
    };
  }
}
