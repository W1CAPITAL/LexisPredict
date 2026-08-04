/**
 * Fila BA por cliente — match só desse cliente + advogado/OAB do processo.
 * Logs persistidos em ba_scan_logs (dono = created_by do processo).
 */
'use server';

import {
  getUserContext,
  getStoredCasesForEmpresa,
  listAdvogadosBanca,
} from '@/lib/server-db';
import { createClient } from '@supabase/supabase-js';
import {
  fetchDjenPorNomeParte,
  fetchDjenPorTexto,
} from '@/lib/djen-busca-texto';
import {
  textoIndicaBuscaApreensao,
  nomeApareceNoTexto,
  oabApareceNoTexto,
  normalizeName,
} from '@/lib/busca-apreensao-logic';

export interface BaHit {
  id: string;
  data: string | null;
  tribunal: string | null;
  orgao: string | null;
  processo: string | null;
  clienteNome: string;
  advogadoNome: string | null;
  advogadoOab: string | null;
  trecho: string;
  motivoBa: string;
  link: string | null;
  createdBy: string | null;
  protocolosCarteira: string[];
}

export interface BaQueueItem {
  nome: string;
  protocolos: string[];
  advogadoNome: string | null;
  advogadoOab: string | null;
  createdBy: string | null;
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function resolveOab(
  advogadoNome: string | null,
  banca: Array<{ nome?: string; oab?: string; numero_oab?: string }>
): string | null {
  if (!advogadoNome) return null;
  const n = normalizeName(advogadoNome);
  for (const a of banca) {
    const an = normalizeName(String(a.nome || ''));
    if (!an) continue;
    if (an === n || an.includes(n) || n.includes(an)) {
      const oab = String(a.oab || a.numero_oab || '').trim();
      if (oab) return oab;
    }
  }
  return null;
}

/** Fila: 1 item por cliente, com advogado principal e OAB da banca se houver. */
export async function listBaQueueAction() {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) {
    return { success: false as const, error: 'Sessão expirada.', queue: [] as BaQueueItem[] };
  }

  const cases = (await getStoredCasesForEmpresa(ctx.empresa_id)) || [];
  const advs = ((await listAdvogadosBanca()) || []) as any[];

  type Acc = {
    nome: string;
    protocolos: string[];
    advogadoNome: string | null;
    createdBy: string | null;
  };
  const map = new Map<string, Acc>();

  for (const c of cases as any[]) {
    const nome = String(c.cliente || c.nome || '').trim();
    if (nome.length < 6) continue;
    const key = normalizeName(nome);
    const proto = String(c.protocolo || c.protocolo_ref || '');
    const adv = String(c.advogado || c.advogado_responsavel || '').trim() || null;
    const owner = (c.created_by as string) || ctx.auth_id || null;

    if (!map.has(key)) {
      map.set(key, {
        nome,
        protocolos: proto ? [proto] : [],
        advogadoNome: adv,
        createdBy: owner,
      });
    } else {
      const acc = map.get(key)!;
      if (proto && !acc.protocolos.includes(proto)) acc.protocolos.push(proto);
      if (!acc.advogadoNome && adv) acc.advogadoNome = adv;
      if (!acc.createdBy && owner) acc.createdBy = owner;
    }
  }

  const queue: BaQueueItem[] = [...map.values()]
    .map((acc) => ({
      ...acc,
      advogadoOab: resolveOab(acc.advogadoNome, advs),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return { success: true as const, queue, total: queue.length };
}

async function persistBaHits(
  hits: BaHit[],
  empresaId: string
): Promise<void> {
  if (!hits.length) return;
  const admin = getAdmin();
  if (!admin) return;

  const rows = hits.map((h) => ({
    empresa_id: empresaId,
    created_by: h.createdBy,
    cliente_nome: h.clienteNome,
    advogado_nome: h.advogadoNome,
    advogado_oab: h.advogadoOab,
    protocolo_ref: h.protocolosCarteira[0] || null,
    processo_djen: h.processo,
    data_publicacao: h.data,
    motivo_ba: h.motivoBa,
    trecho: h.trecho,
    link: h.link,
    tribunal: h.tribunal,
    payload: {
      orgao: h.orgao,
      protocolos: h.protocolosCarteira,
      id: h.id,
    },
  }));

  // ignore if table missing
  const { error } = await admin.from('ba_scan_logs').insert(rows);
  if (error) {
    console.error('[ba_scan_logs]', error.message);
  }
}

/**
 * Um cliente da fila: DJEN por nome (+ OAB do advogado se houver).
 * Match NÃO lista outros clientes da carteira.
 */
export async function scanOneClienteBaAction(
  nomeCliente: string,
  meta?: {
    advogadoNome?: string | null;
    advogadoOab?: string | null;
    protocolos?: string[];
    createdBy?: string | null;
  }
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

  const advogadoNome = meta?.advogadoNome?.trim() || null;
  let advogadoOab = meta?.advogadoOab?.trim() || null;
  const protocolos = meta?.protocolos || [];
  const createdBy = meta?.createdBy || ctx.auth_id || null;

  if (!advogadoOab && advogadoNome) {
    const advs = ((await listAdvogadosBanca()) || []) as any[];
    advogadoOab = resolveOab(advogadoNome, advs);
  }

  const dataFim = new Date().toISOString().split('T')[0];
  const dataInicio = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // 1) Por nome do titular
  let res = await fetchDjenPorNomeParte(nome, {
    dataInicio,
    dataFim,
    itensPorPagina: 50,
  });

  if (res.isRateLimited) {
    return {
      success: false as const,
      error: res.error || 'Rate limit DJEN (429).',
      hits: [] as BaHit[],
      isRateLimited: true,
      nome,
      advogadoNome,
      advogadoOab,
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

  // 2) Reforço com OAB no teor (advogado específico), se houver
  if (res.success && advogadoOab) {
    const oabDigits = advogadoOab.replace(/\D/g, '');
    if (oabDigits.length >= 4) {
      const resOab = await fetchDjenPorTexto(`busca e apreensão ${oabDigits}`, {
        dataInicio,
        dataFim,
        nomeParte: nome,
        itensPorPagina: 30,
      });
      if (resOab.isRateLimited) {
        return {
          success: false as const,
          error: resOab.error || 'Rate limit DJEN (429).',
          hits: [] as BaHit[],
          isRateLimited: true,
          nome,
          advogadoNome,
          advogadoOab,
        };
      }
      if (resOab.success && resOab.items.length) {
        const seenIds = new Set(res.items.map((i) => String(i.id)));
        for (const it of resOab.items) {
          if (!seenIds.has(String(it.id))) res.items.push(it);
        }
      }
    }
  }

  if (!res.success) {
    return {
      success: false as const,
      error: res.error || 'Falha DJEN',
      hits: [] as BaHit[],
      isRateLimited: !!res.isRateLimited,
      nome,
      advogadoNome,
      advogadoOab,
    };
  }

  const hits: BaHit[] = [];
  const seen = new Set<string>();

  for (const item of res.items) {
    const det = textoIndicaBuscaApreensao(item.texto);
    if (!det.hit) continue;

    // Só aceita se o cliente (titular) aparece OU a busca já foi por nomeParte
    const titularNoTexto = nomeApareceNoTexto(item.texto || '', nome);
    const oabNoTexto =
      advogadoOab && oabApareceNoTexto(item.texto || '', advogadoOab);
    const advNoTexto =
      advogadoNome && nomeApareceNoTexto(item.texto || '', advogadoNome);

    // Se veio de nomeParte, confia; senão exige titular ou OAB/advogado do processo
    if (!titularNoTexto && !oabNoTexto && !advNoTexto) {
      // ainda pode ser resultado de nomeParte da API
      // mantém se a API filtrou por nomeParte
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
      clienteNome: nome,
      advogadoNome,
      advogadoOab,
      trecho: (item.texto || '').slice(0, 500),
      motivoBa: det.motivo || 'BUSCA E APREENSÃO',
      link: item.link,
      createdBy,
      protocolosCarteira: protocolos,
    });
  }

  if (hits.length) {
    await persistBaHits(hits, ctx.empresa_id);
  }

  // log de consulta (mesmo sem BA) — 1 linha por cliente
  try {
    const admin = getAdmin();
    if (admin) {
      await admin.from('ba_scan_logs').insert({
        empresa_id: ctx.empresa_id,
        created_by: createdBy,
        cliente_nome: nome,
        advogado_nome: advogadoNome,
        advogado_oab: advogadoOab,
        protocolo_ref: protocolos[0] || null,
        processo_djen: null,
        data_publicacao: null,
        motivo_ba: hits.length ? 'BA_ENCONTRADO' : 'CONSULTA_SEM_BA',
        trecho: hits.length
          ? `${hits.length} publicação(ões) BA`
          : `Consultado DJEN · ${res.items.length} pub(s) · sem BA`,
        link: null,
        tribunal: null,
        payload: {
          tipo: 'scan_tick',
          pubs: res.items.length,
          hits: hits.length,
          protocolos,
        },
      });
    }
  } catch {
    /* tabela pode não existir ainda */
  }

  return {
    success: true as const,
    hits,
    nome,
    advogadoNome,
    advogadoOab,
    isRateLimited: false,
    pubs: res.items.length,
  };
}

/** Logs salvos do usuário (ou empresa se master). */
export async function listBaScanLogsAction(limit = 50) {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) {
    return { success: false as const, error: 'Sessão expirada.', logs: [] as any[] };
  }

  const admin = getAdmin();
  if (!admin) {
    return { success: false as const, error: 'Admin Supabase indisponível.', logs: [] as any[] };
  }

  let q = admin
    .from('ba_scan_logs')
    .select('*')
    .eq('empresa_id', ctx.empresa_id)
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 100));

  if (!ctx.isMasterView && ctx.auth_id) {
    q = q.eq('created_by', ctx.auth_id);
  }

  const { data, error } = await q;
  if (error) {
    return {
      success: false as const,
      error:
        error.message.includes('ba_scan_logs')
          ? 'Tabela ba_scan_logs ausente. Rode o SQL do LEIA-ME no Supabase.'
          : error.message,
      logs: [] as any[],
    };
  }
  return { success: true as const, logs: data || [] };
}
