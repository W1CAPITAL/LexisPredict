/**
 * Compat do botão "Abrir tribunal" — usa stack Enriquecer e-SAJ (sem GCloud Run).
 */
'use server';

import {
  enrichWithEsaJAction,
  getConsultaUrlAction,
} from '@/app/actions/esa-j-actions';
import { getTribunalFromCnj } from '@/lib/tribunais-cnj';

export async function openTribunalViaGcloudAction(
  cnjRaw: string,
  action: 'open' | 'fetch' | 'screenshot' = 'fetch'
) {
  const cnj = cnjRaw.trim();
  const dig = cnj.replace(/\D/g, '');
  if (dig.length !== 20) {
    return { success: false, error: 'CNJ inválido (20 dígitos).', usedGcloud: false, usedEsaj: false };
  }

  const tribunal = getTribunalFromCnj(cnj);
  const consulta = await getConsultaUrlAction(cnj);
  const openUrl = consulta?.url || null;

  // Sempre tenta enrich e-SAJ (mesmo do botão Enriquecer)
  let enrich: any = null;
  try {
    enrich = await enrichWithEsaJAction(cnj);
  } catch (e: any) {
    enrich = { success: false, note: e?.message || 'Falha enrich' };
  }

  const usedEsaj = !!(enrich?.success && enrich?.data);

  return {
    success: !!(openUrl || usedEsaj),
    usedGcloud: false,
    usedEsaj,
    openUrl,
    tribunal: consulta?.nome || tribunal?.nome || enrich?.data?.tribunal,
    sistema: consulta?.sistema || tribunal?.sistema,
    message: usedEsaj
      ? `Enriquecido via e-SAJ · ${consulta?.nome || ''}`
      : openUrl
        ? `URL do ${consulta?.nome || 'tribunal'} pronta (enrich e-SAJ indisponível neste CNJ)`
        : enrich?.note || 'Sem URL e sem enrich',
    data: enrich?.data || null,
    note: enrich?.note,
  };
}

export async function pingGcloudTribunalGatewayAction() {
  return {
    configured: true,
    ok: true,
    message: 'Stack interno Enriquecer e-SAJ (sem GCloud Run)',
  };
}
