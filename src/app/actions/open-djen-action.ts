'use server';

/**
 * Abre / resolve publicacao DJEN + log detalhado de auditoria.
 */
import { getUserContext, getSupabaseAdmin } from '@/lib/server-db';
import { fetchDjenComunicacoes, resolveDjenPublicacaoLink, plainTextFromDjen } from '@/lib/djen';
import { logAlertEvent, logScanMetric } from '@/lib/scan-metrics';

export async function openDjenPublicacaoAction(protocolo: string) {
  const t0 = Date.now();
  try {
    const { empresa_id } = await getUserContext();
    if (!empresa_id) return { success: false as const, error: '401' };
    const digits = String(protocolo || '').replace(/\D/g, '');
    if (digits.length !== 20) {
      return { success: false as const, error: 'CNJ invalido' };
    }

    const djen = await fetchDjenComunicacoes(digits, {
      dataInicio: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });

    await logScanMetric({
      empresaId: String(empresa_id),
      source: 'djen',
      success: !!djen.success,
      protocolo: digits,
      errorCode: djen.success ? undefined : djen.error || 'DJEN_FAIL',
      latencyMs: Date.now() - t0,
    });

    const items = djen.items || [];
    const sorted = [...items].sort((a, b) => {
      const da = a.data_disponibilizacao ? new Date(a.data_disponibilizacao).getTime() : 0;
      const db = b.data_disponibilizacao ? new Date(b.data_disponibilizacao).getTime() : 0;
      return db - da;
    });
    const top = sorted[0];
    const link = top
      ? resolveDjenPublicacaoLink(top, digits)
      : resolveDjenPublicacaoLink(null, digits);

    // Persist link no processo
    if (link || top) {
      try {
        const admin = await getSupabaseAdmin();
        const { data: row } = await admin
          .from('processos')
          .select('id, dados')
          .eq('empresa_id', empresa_id)
          .eq('protocolo_ref', protocolo)
          .maybeSingle();
        // try digits protocol too
        let dbItem = row;
        if (!dbItem) {
          const r2 = await admin
            .from('processos')
            .select('id, dados')
            .eq('empresa_id', empresa_id)
            .eq('protocolo_ref', digits)
            .maybeSingle();
          dbItem = r2.data;
        }
        if (dbItem) {
          const dados = { ...((dbItem.dados as any) || {}) };
          dados.djen_ultimo_link = link || dados.djen_ultimo_link || null;
          dados.djen_ultima_data = top?.data_disponibilizacao || dados.djen_ultima_data || null;
          dados.djen_ultimo_resumo =
            (top?.texto ? plainTextFromDjen(top.texto).slice(0, 200) : null) ||
            top?.tipoComunicacao ||
            dados.djen_ultimo_resumo ||
            null;
          dados.djen_count = items.length || dados.djen_count || 0;
          dados.djen_consultado_em = new Date().toISOString();
          await admin
            .from('processos')
            .update({
              dados,
              djen_ultimo_link: link,
              djen_ultima_data: top?.data_disponibilizacao || null,
            } as any)
            .eq('id', dbItem.id);
        }
      } catch (e) {
        console.error('[openDjen] persist', e);
      }
    }

    await logAlertEvent({
      empresaId: String(empresa_id),
      protocolo: digits,
      eventType: 'acked',
      source: 'djen_open',
      payload: {
        link,
        count: items.length,
        topTipo: top?.tipoComunicacao || null,
        topData: top?.data_disponibilizacao || null,
        topOrgao: top?.nomeOrgao || null,
        latencyMs: Date.now() - t0,
        success: djen.success,
        error: djen.error || null,
      },
    });

    console.info(
      '[audit-djen-open]',
      JSON.stringify({
        protocolo: digits,
        link,
        count: items.length,
        ms: Date.now() - t0,
        ok: djen.success,
      })
    );

    if (!link) {
      return {
        success: false as const,
        error: djen.error || 'Sem link de publicacao no DJEN',
        count: items.length,
        items: sorted.slice(0, 5).map((i) => ({
          data: i.data_disponibilizacao,
          tipo: i.tipoComunicacao,
          orgao: i.nomeOrgao,
          link: resolveDjenPublicacaoLink(i, digits),
        })),
      };
    }

    return {
      success: true as const,
      link,
      count: items.length,
      resumo: top?.tipoComunicacao || top?.texto?.slice(0, 120) || null,
      data: top?.data_disponibilizacao || null,
      orgao: top?.nomeOrgao || null,
    };
  } catch (e: any) {
    return { success: false as const, error: e?.message || 'Falha DJEN' };
  }
}
