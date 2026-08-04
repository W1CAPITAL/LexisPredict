/**
 * Abrir tribunal: eproc prioritário (TJSP), e-SAJ secundário.
 * Sem GCloud Run. Embed no app usa openUrl retornada aqui.
 */
'use server';

import { enrichWithEsaJAction } from '@/app/actions/esa-j-actions';
import {
  getConsultaUrlForCnj,
  getTribunalByCnj,
  getFallbacksForCnj,
} from '@/lib/tribunais-links';
import { getTribunalFromCnj } from '@/lib/tribunais-cnj';

export async function openTribunalViaGcloudAction(
  cnjRaw: string,
  _action: 'open' | 'fetch' | 'screenshot' = 'fetch'
) {
  const cnj = cnjRaw.trim();
  const dig = cnj.replace(/\D/g, '');
  if (dig.length !== 20) {
    return {
      success: false,
      error: 'CNJ inválido (20 dígitos).',
      usedGcloud: false,
      usedEsaj: false,
    };
  }

  const link = getTribunalByCnj(cnj);
  const openUrl =
    getConsultaUrlForCnj(cnj) ||
    getTribunalFromCnj(cnj)?.consultaUrl(cnj) ||
    null;
  const fallbacks = getFallbacksForCnj(cnj);

  let enrich: any = null;
  try {
    enrich = await enrichWithEsaJAction(cnj);
  } catch (e: any) {
    enrich = { success: false, note: e?.message || 'Falha enrich e-SAJ' };
  }

  const usedEsaj = !!(enrich?.success && enrich?.data);

  return {
    success: !!(openUrl || usedEsaj),
    usedGcloud: false,
    usedEsaj,
    openUrl,
    tribunal: link?.sigla || getTribunalFromCnj(cnj)?.nome,
    sistema: link?.sistema || getTribunalFromCnj(cnj)?.sistema,
    nome: link?.nome,
    fallbacks,
    message: openUrl
      ? `Principal: ${link?.sistema || 'consulta'} · ${link?.sigla || ''}`
      : enrich?.note || 'Sem URL',
    data: enrich?.data || null,
    note: enrich?.note,
  };
}

export async function pingGcloudTribunalGatewayAction() {
  return {
    configured: true,
    ok: true,
    message: 'eproc prioritário (SP) · embed no app · e-SAJ secundário',
  };
}
