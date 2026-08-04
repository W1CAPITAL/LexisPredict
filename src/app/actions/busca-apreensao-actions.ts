/**
 * Fila BA: 1 cliente por vez (nome na carteira → DJEN).
 * Evita 429: o cliente (UI) chama scanOne com delay entre itens.
 */
'use server';

import {
  getUserContext,
  getStoredCasesForEmpresa,
  listAdvogadosBanca,
} from '@/lib/server-db';
import {
  fetchDjenPorNomeParte,
  fetchDjenPorTexto,
} from '@/lib/djen-busca-texto';
import {
  textoIndicaBuscaApreensao,
  nomeApareceNoTexto,
  cruzarPublicacaoComCarteira,
  type MatchResult,
} from '@/lib/busca-apreensao-logic';

export interface BaHit {
  id: string;
  data: string | null;
  tribunal: string | null;
  orgao: string | null;
  processo: string | null;
  clienteBusca: string;
  trecho: string;
  motivoBa: string;
  link: string | null;
  matches: MatchResult[];
  titularOk: boolean;
}

export interface BaQueueItem {
  nome: string;
  protocolos: string[];
}

/** Lista nomes únicos de clientes da carteira (fila). */
export async function listBaQueueAction() {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) {
    return { success: false as const, error: 'Sessão expirada.', queue: [] as BaQueueItem[] };
  }

  const cases = (await getStoredCasesForEmpresa(ctx.empresa_id)) || [];
  const map = new Map<string, string[]>();

  for (const c of cases as any[]) {
    const nome = String(c.cliente || c.nome || '').trim();
    if (nome.length < 6) continue;
    const key = nome.toUpperCase();
    const proto = String(c.protocolo || c.protocolo_ref || '');
    if (!map.has(key)) map.set(key, []);
    if (proto) map.get(key)!.push(proto);
  }

  const queue: BaQueueItem[] = [...map.entries()]
    .map(([_, protocolos]) => {
      const original =
        (cases as any[]).find(
          (c) => String(c.cliente || '').trim().toUpperCase() === _
        )?.cliente || _;
      return {
        nome: String(original).trim(),
        protocolos: [...new Set(protocolos)],
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return {
    success: true as const,
    queue,
    total: queue.length,
  };
}

/**
 * Um cliente da fila: busca DJEN por nomeParte + filtro BA no teor.
 * Qualquer data no período (default 5 anos). NÃO varre todos os CNJs.
 */
export async function scanOneClienteBaAction(
  nomeCliente: string,
  opts?: { dataInicio?: string; dataFim?: string }
) {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) {
    return {
      success: false as const,
      error: 'Sessão expirada.',
      hits: [] as BaHit[],
      isRateLimited: false,
    };
  }

  const nome = String(nomeCliente || '').trim();
  if (nome.length < 6) {
    return {
      success: false as const,
      error: 'Nome inválido.',
      hits: [] as BaHit[],
      isRateLimited: false,
    };
  }

  const cases = (await getStoredCasesForEmpresa(ctx.empresa_id)) || [];
  const advs = (await listAdvogadosBanca()) || [];

  const clientes = cases
    .map((c: any) => ({
      nome: String(c.cliente || ''),
      protocolo: String(c.protocolo || c.protocolo_ref || ''),
    }))
    .filter((c) => c.nome.length >= 6);

  const advogadosBanca = advs
    .map((a: any) => String(a.nome || ''))
    .filter((n) => n.length >= 6);

  const advogadosProcesso = cases
    .map((c: any) => ({
      nome: String(c.advogado || ''),
      protocolo: String(c.protocolo || c.protocolo_ref || ''),
    }))
    .filter((a) => a.nome.length >= 6);

  const dataFim = opts?.dataFim || new Date().toISOString().split('T')[0];
  const dataInicio =
    opts?.dataInicio ||
    new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 1) Por nome da parte (titular)
  let res = await fetchDjenPorNomeParte(nome, { dataInicio, dataFim, itensPorPagina: 50 });

  if (res.isRateLimited) {
    return {
      success: false as const,
      error: res.error || 'Rate limit DJEN (429).',
      hits: [] as BaHit[],
      isRateLimited: true,
      nome,
    };
  }
  if (res.isGeoBlocked) {
    return {
      success: false as const,
      error: res.error || 'Geo-block DJEN.',
      hits: [] as BaHit[],
      isRateLimited: false,
      isGeoBlocked: true,
      nome,
    };
  }

  // 2) Se vazio, reforço: teor "busca e apreensão" + nomeParte
  if (res.success && res.items.length === 0) {
    res = await fetchDjenPorTexto('busca e apreensão', {
      dataInicio,
      dataFim,
      nomeParte: nome,
      itensPorPagina: 50,
    });
    if (res.isRateLimited) {
      return {
        success: false as const,
        error: res.error || 'Rate limit DJEN (429).',
        hits: [] as BaHit[],
        isRateLimited: true,
        nome,
      };
    }
  }

  if (!res.success) {
    return {
      success: false as const,
      error: res.error || 'Falha DJEN',
      hits: [] as BaHit[],
      isRateLimited: !!res.isRateLimited,
      nome,
    };
  }

  const hits: BaHit[] = [];
  const seen = new Set<string>();

  for (const item of res.items) {
    const det = textoIndicaBuscaApreensao(item.texto);
    if (!det.hit) continue;

    // Titular da carteira deve aparecer no teor (ou já veio por nomeParte)
    const titularOk =
      nomeApareceNoTexto(item.texto || '', nome) ||
      true; // busca já foi por nomeParte

    const matches = cruzarPublicacaoComCarteira(item.texto || '', {
      clientes,
      advogadosBanca,
      advogadosProcesso,
    });

    if (!matches.some((m) => m.tipo === 'cliente' && m.nome.toUpperCase() === nome.toUpperCase())) {
      matches.unshift({ tipo: 'titular', nome, protocolo: null });
    }

    const key = `${item.id}|${item.numero_processo || ''}|${item.data_disponibilizacao || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    hits.push({
      id: key,
      data: item.data_disponibilizacao,
      tribunal: item.siglaTribunal,
      orgao: item.nomeOrgao,
      processo: item.numero_processo,
      clienteBusca: nome,
      trecho: (item.texto || '').slice(0, 500),
      motivoBa: det.motivo || 'BUSCA E APREENSÃO',
      link: item.link,
      matches,
      titularOk,
    });
  }

  return {
    success: true as const,
    hits,
    nome,
    isRateLimited: false,
    pubs: res.items.length,
  };
}
