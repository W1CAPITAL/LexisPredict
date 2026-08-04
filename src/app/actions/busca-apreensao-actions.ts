/**
 * Varredura Busca e Apreensão — SOMENTE processos da carteira do usuário (empresa).
 * Consulta DJEN por CNJ de cada processo; não busca publicação genérica de terceiros.
 */
'use server';

import {
  getUserContext,
  getStoredCasesForEmpresa,
  listAdvogadosBanca,
} from '@/lib/server-db';
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
  cliente: string | null;
  trecho: string;
  motivoBa: string;
  link: string | null;
  matches: MatchResult[];
  fonte: 'carteira_cnj';
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Varre DJEN apenas nos CNJs da carteira da empresa do usuário logado.
 */
export async function runBuscaApreensaoDjenAction(opts?: {
  dias?: number;
  /** limite de processos ativos a consultar (default 80) */
  limite?: number;
  /** incluir encerrados */
  incluirEncerrados?: boolean;
}) {
  try {
    const ctx = await getUserContext();
    const empresa_id = ctx?.empresa_id;
    if (!empresa_id) {
      return {
        success: false as const,
        error: 'Sessão expirada.',
        hits: [] as BaHit[],
      };
    }

    const dias = Math.min(Math.max(opts?.dias ?? 30, 1), 90);
    const dataInicio = daysAgoIso(dias);
    const dataFim = todayIso();
    const limite = Math.min(Math.max(opts?.limite ?? 80, 1), 150);

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

    // Só carteira do usuário/empresa
    let fila = cases.filter((c: any) => {
      const proto = String(c.protocolo || c.protocolo_ref || '').replace(/\D/g, '');
      if (proto.length !== 20) return false;
      if (opts?.incluirEncerrados) return true;
      const st = String(c.status || c.situacao || '').toUpperCase();
      return !/(ENCERRADO|ARQUIVADO)/.test(st) || st === 'É HOJE' || st === 'VENCIDO';
    });

    // Prioriza quem já tem indício BA ou status crítico
    fila = [...fila].sort((a: any, b: any) => {
      const pa = a.indicio_busca_apreensao ? 0 : 1;
      const pb = b.indicio_busca_apreensao ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return 0;
    });

    fila = fila.slice(0, limite);

    const hits: BaHit[] = [];
    const seen = new Set<string>();
    let scanned = 0;
    let errors = 0;
    let geoBlocked = false;
    let rateLimited = false;

    for (const c of fila) {
      const proto = String(c.protocolo || c.protocolo_ref || '');
      const clienteNome = String(c.cliente || '');
      scanned++;

      const res = await fetchDjenComunicacoes(proto, {
        dataInicio,
        dataFim,
      });

      if (!res.success) {
        errors++;
        if (res.isGeoBlocked) geoBlocked = true;
        if (res.isRateLimited) rateLimited = true;
        if (geoBlocked || rateLimited) break;
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

        // Garante vínculo com o processo da carteira
        if (clienteNome && !matches.some((m) => m.tipo === 'cliente' && m.protocolo === proto)) {
          matches.unshift({
            tipo: 'cliente',
            nome: clienteNome,
            protocolo: proto,
          });
        }

        const key = `${proto}|${item.id}|${item.data_disponibilizacao || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);

        hits.push({
          id: key,
          data: item.data_disponibilizacao,
          tribunal: item.siglaTribunal,
          orgao: item.nomeOrgao,
          processo: item.numero_processo || proto,
          cliente: clienteNome || null,
          trecho: (item.texto || '').slice(0, 500),
          motivoBa: det.motivo || 'BUSCA E APREENSÃO',
          link: item.link,
          matches,
          fonte: 'carteira_cnj',
        });
      }
    }

    hits.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

    if (geoBlocked) {
      return {
        success: false as const,
        error:
          'DJEN geo-bloqueou o servidor (403). Vercel deve estar em São Paulo (gru1).',
        hits,
        scanned,
        geoBlocked: true,
      };
    }
    if (rateLimited) {
      return {
        success: false as const,
        error: 'Rate limit DJEN (429). Aguarde e tente de novo.',
        hits,
        scanned,
        rateLimited: true,
      };
    }

    return {
      success: true as const,
      hits,
      scanned,
      errors,
      carteiraSize: cases.length,
      filaSize: fila.length,
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
