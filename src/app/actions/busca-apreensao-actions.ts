/**
 * Fila BA por CLIENTE (principal) + CNJ da carteira. Advogado/OAB só reforço opcional no DJEN.
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
  publicacaoBateComCarteira,
  mesmoCnj,
  digitsOnly,
  detectarBaCompleto,
  labelTipoBa,
  type BaTipo,
} from '@/lib/busca-apreensao-logic';

export interface BaHit {
  id: string;
  data: string | null;
  tribunal: string | null;
  orgao: string | null;
  processoDjen: string | null;
  protocoloCarteira: string | null;
  protocolosCarteira: string[];
  clienteNome: string;
  advogadoNome: string | null;
  advogadoOab: string | null;
  trecho: string;
  motivoBa: string;
  link: string | null;
  createdBy: string | null;
  tipoBa: BaTipo;
  alertarOperacional: boolean;
  ufCarteira: string | null;
  ufMandado: string | null;
  geoMotivo: string;
  geoDistante: boolean;
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

  // Só BA real; dedupe por empresa + processo DJEN + protocolo carteira
  for (const h of hits) {
    if (!h.motivoBa || h.motivoBa === 'CONSULTA_SEM_BA') continue;

    const processoDjen = h.processoDjen || null;
    const protocoloCarteira = h.protocoloCarteira || h.protocolosCarteira[0] || null;

    // Evita duplicado: mesmo processo DJEN (ou mesmo par carteira+djen)
    let q = admin
      .from('ba_scan_logs')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('motivo_ba', h.motivoBa)
      .limit(1);

    if (processoDjen) {
      q = q.eq('processo_djen', processoDjen);
    } else if (protocoloCarteira) {
      q = q.eq('protocolo_ref', protocoloCarteira);
    }

    const { data: existing } = await q.maybeSingle();
    if (existing?.id) {
      // atualiza trecho/data se já existe
      await admin
        .from('ba_scan_logs')
        .update({
          trecho: h.trecho,
          data_publicacao: h.data,
          link: h.link,
          tribunal: h.tribunal,
          advogado_nome: h.advogadoNome,
          advogado_oab: h.advogadoOab,
          protocolo_ref: protocoloCarteira,
          processo_djen: processoDjen,
          payload: {
            orgao: h.orgao,
            protocolos_carteira: h.protocolosCarteira,
            processo_djen: processoDjen,
            protocolo_carteira: protocoloCarteira,
            id: h.id,
          },
        })
        .eq('id', existing.id);
      continue;
    }

    const { error } = await admin.from('ba_scan_logs').insert({
      empresa_id: empresaId,
      created_by: h.createdBy,
      cliente_nome: h.clienteNome,
      advogado_nome: h.advogadoNome,
      advogado_oab: h.advogadoOab,
      protocolo_ref: protocoloCarteira,
      processo_djen: processoDjen,
      data_publicacao: h.data,
      motivo_ba: h.motivoBa,
      trecho: h.trecho,
      link: h.link,
      tribunal: h.tribunal,
      payload: {
        orgao: h.orgao,
        protocolos_carteira: h.protocolosCarteira,
        processo_djen: processoDjen,
        protocolo_carteira: protocoloCarteira,
        id: h.id,
      },
    });
    if (error) console.error('[ba_scan_logs]', error.message);
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
    preferredMotor?: string | null;
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

  // ========== 1) PRINCIPAL: DJEN pelo NOME DO CLIENTE ==========
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

  // ========== 2) OPCIONAL: reforço OAB só se poucos resultados ==========
  // Advogado NÃO é critério de aceite do hit — só amplia a varredura DJEN.
  if (res.success && advogadoOab && (res.items?.length || 0) < 5) {
    const oabDigits = advogadoOab.replace(/\D/g, '');
    if (oabDigits.length >= 4) {
      const resOab = await fetchDjenPorTexto(`busca e apreensão ${oabDigits}`, {
        dataInicio,
        dataFim,
        nomeParte: nome,
        itensPorPagina: 20,
      });
      if (resOab.isRateLimited) {
        // não aborta a varredura principal — só ignora reforço
      } else if (resOab.success && resOab.items.length) {
        const seenIds = new Set(res.items.map((i) => String(i.id)));
        for (const it of resOab.items) {
          if (!seenIds.has(String(it.id))) res.items.push(it);
        }
      }
    }
  }

  // ========== 3) OPCIONAL: varre CNJs da carteira no teor BA ==========
  if (res.success && protocolos.length) {
    for (const p of protocolos.slice(0, 8)) {
      const dig = digitsOnly(p);
      if (dig.length < 15) continue;
      try {
        const resCnj = await fetchDjenPorTexto(`busca e apreensão ${dig}`, {
          dataInicio,
          dataFim,
          itensPorPagina: 15,
        });
        if (resCnj.success && resCnj.items?.length) {
          const seenIds = new Set(res.items.map((i) => String(i.id)));
          for (const it of resCnj.items) {
            if (!seenIds.has(String(it.id))) res.items.push(it);
          }
        }
      } catch {
        /* ignora falha pontual */
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
  const seenProcesso = new Set<string>();

  for (const item of res.items || []) {
    const processoDjen = item.numero_processo
      ? String(item.numero_processo)
      : null;

    const full = detectarBaCompleto({
      texto: item.texto || '',
      processoDjen,
      tribunalSigla: item.siglaTribunal || null,
      protocolosCarteira: protocolos,
    });
    if (!full.hit) continue;

    const vinculo = publicacaoBateComCarteira({
      texto: item.texto || '',
      processoDjen,
      protocolosCarteira: protocolos,
      clienteNome: nome,
    });
    if (!vinculo.ok) continue;

    let protocoloCarteira: string | null = null;
    for (const p of protocolos) {
      if (mesmoCnj(processoDjen, p)) {
        protocoloCarteira = p;
        break;
      }
    }
    if (!protocoloCarteira) {
      for (const p of protocolos) {
        const dig = digitsOnly(p);
        if (dig.length >= 15 && digitsOnly(item.texto || '').includes(dig)) {
          protocoloCarteira = p;
          break;
        }
      }
    }
    if (!protocoloCarteira && protocolos.length === 1) {
      protocoloCarteira = protocolos[0];
    }

    const key = `${item.id}|${processoDjen || ''}|${item.data_disponibilizacao || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const digKey =
      digitsOnly(processoDjen || protocoloCarteira || key) || key;
    if (seenProcesso.has(digKey)) continue;
    seenProcesso.add(digKey);

    hits.push({
      id: key,
      data: item.data_disponibilizacao,
      tribunal: item.siglaTribunal,
      orgao: item.nomeOrgao,
      processoDjen,
      protocoloCarteira,
      protocolosCarteira: protocolos,
      clienteNome: nome,
      advogadoNome,
      advogadoOab,
      trecho: `[${vinculo.motivoMatch}] [${labelTipoBa(full.tipo)}] ${full.geo.motivoGeo}${full.geo.distante ? ' · GEO DISTANTE' : ''}\n${(item.texto || '').slice(0, 480)}`,
      motivoBa: full.motivo || 'BUSCA E APREENSÃO',
      link: item.link,
      createdBy,
      tipoBa: full.tipo,
      alertarOperacional: full.alertarOperacional,
      ufCarteira: full.geo.ufCarteira,
      ufMandado: full.geo.ufMandado,
      geoMotivo: full.geo.motivoGeo,
      geoDistante: full.geo.distante,
    });
  }

    if (hits.length) {
    await persistBaHits(hits, ctx.empresa_id);
  }

  

  // Confirmação opcional via IA (motor escolhido na UI)
  let engineUsed: string | null = null;
  let iaNote: string | null = null;
  const motor = (meta?.preferredMotor || '').trim();
  if (motor && motor !== 'local_only' && hits.length) {
    try {
      const { runCascade } = await import('@/lib/ai/cascade');
      const teor = hits
        .slice(0, 3)
        .map((h) => h.trecho)
        .join('\n---\n')
        .slice(0, 5000);
      const r = await runCascade({
        preferred: motor,
        surface: 'ba',
        system:
          'Classifique publicações DJEN. JSON: {"is_ba":boolean,"confidence":0-1,"reason":"string"}. is_ba só se mandado de busca e apreensão de bem.',
        messages: [{ role: 'user', content: teor }],
        max_tokens: 250,
        temperature: 0,
      });
      engineUsed = `${r.engineId}:${r.model}`;
      const m = r.text.match(/\{[\s\S]*\}/);
      if (m) {
        const j = JSON.parse(m[0]);
        iaNote = j.is_ba
          ? `IA ${engineUsed} CONFIRMA BA (${Math.round((j.confidence || 0) * 100)}%): ${j.reason || ''}`
          : `IA ${engineUsed} NÃO confirma BA: ${j.reason || ''}`;
      } else {
        iaNote = `IA ${engineUsed} respondeu sem JSON.`;
      }
    } catch (e: any) {
      engineUsed = motor;
      iaNote = `IA ${motor} falhou: ${e?.message || e}`;
    }
  }

  return {
    success: true as const,
    hits,
    nome,
    advogadoNome,
    advogadoOab,
    isRateLimited: false,
    pubs: res.items.length,
    engineUsed,
    iaNote,
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
