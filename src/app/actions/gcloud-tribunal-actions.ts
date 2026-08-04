/**
 * Gateway GCloud → abre/consulta tribunal.
 * Configure no Vercel:
 *   GCLOUD_TRIBUNAL_GATEWAY_URL = https://SEU-SERVICO.run.app
 *   GCLOUD_TRIBUNAL_GATEWAY_SECRET = (opcional) Bearer
 *
 * O serviço no Cloud Run deve aceitar POST JSON:
 *   { cnj, url, tribunal, sistema, action: "open" | "fetch" | "screenshot" }
 * e responder:
 *   { success, openUrl?, html?, screenshotBase64?, message? }
 *
 * Sem gateway configurado → usa URL pública do tribunal (mesmo comportamento de antes).
 */
'use server';

import {
  getTribunalByCnj,
  getConsultaUrlForCnj,
  getFallbacksForCnj,
  codigoJusticaFromCnj,
} from '@/lib/tribunais-links';

function digits(cnj: string) {
  return String(cnj || '').replace(/\D/g, '');
}

function gatewayConfig() {
  const url =
    process.env.GCLOUD_TRIBUNAL_GATEWAY_URL ||
    process.env.GOOGLE_CLOUD_TRIBUNAL_URL ||
    process.env.GCLOUD_BROWSER_URL ||
    '';
  const secret =
    process.env.GCLOUD_TRIBUNAL_GATEWAY_SECRET ||
    process.env.GCLOUD_GATEWAY_SECRET ||
    '';
  return { url: url.replace(/\/$/, ''), secret };
}

export async function openTribunalViaGcloudAction(
  cnjRaw: string,
  action: 'open' | 'fetch' | 'screenshot' = 'open'
) {
  const cnj = cnjRaw.trim();
  const dig = digits(cnj);
  if (dig.length !== 20) {
    return { success: false, error: 'CNJ inválido (20 dígitos).', usedGcloud: false };
  }

  const tribunal = getTribunalByCnj(cnj);
  const consultaUrl = getConsultaUrlForCnj(cnj);
  const fallbacks = getFallbacksForCnj(cnj);
  const code = codigoJusticaFromCnj(cnj);

  if (!consultaUrl || !tribunal) {
    return {
      success: false,
      error: 'Tribunal não mapeado para este CNJ.',
      usedGcloud: false,
      code,
    };
  }

  const { url: gateway, secret } = gatewayConfig();

  // Sem GCloud → devolve URL pública (cliente abre)
  if (!gateway) {
    return {
      success: true,
      usedGcloud: false,
      openUrl: consultaUrl,
      tribunal: tribunal.sigla,
      nome: tribunal.nome,
      sistema: tribunal.sistema,
      code,
      fallbacks,
      message:
        'Gateway GCloud não configurado (GCLOUD_TRIBUNAL_GATEWAY_URL). Abrindo consulta pública.',
    };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (secret) headers['Authorization'] = `Bearer ${secret}`;

    const res = await fetch(`${gateway}/tribunal`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cnj,
        cnjDigits: dig,
        url: consultaUrl,
        tribunal: tribunal.sigla,
        nome: tribunal.nome,
        sistema: tribunal.sistema,
        code,
        fallbacks,
        action,
      }),
      signal: AbortSignal.timeout(55000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // Fallback seguro: ainda devolve URL pública
      return {
        success: true,
        usedGcloud: false,
        openUrl: consultaUrl,
        tribunal: tribunal.sigla,
        sistema: tribunal.sistema,
        code,
        fallbacks,
        message: `GCloud HTTP ${res.status}. Fallback consulta pública. ${text.slice(0, 120)}`,
      };
    }

    const data = await res.json().catch(() => ({}));

    return {
      success: true,
      usedGcloud: true,
      openUrl: data.openUrl || data.url || consultaUrl,
      html: data.html || null,
      screenshotBase64: data.screenshotBase64 || data.screenshot || null,
      tribunal: tribunal.sigla,
      nome: tribunal.nome,
      sistema: tribunal.sistema,
      code,
      fallbacks,
      message: data.message || 'Resposta do gateway GCloud.',
      raw: data,
    };
  } catch (e: any) {
    return {
      success: true,
      usedGcloud: false,
      openUrl: consultaUrl,
      tribunal: tribunal.sigla,
      sistema: tribunal.sistema,
      code,
      fallbacks,
      message: `GCloud indisponível (${e?.message || 'erro'}). Abrindo consulta pública.`,
    };
  }
}

/** Health do gateway (opcional) */
export async function pingGcloudTribunalGatewayAction() {
  const { url, secret } = gatewayConfig();
  if (!url) {
    return { configured: false, ok: false, message: 'GCLOUD_TRIBUNAL_GATEWAY_URL não definido' };
  }
  try {
    const headers: Record<string, string> = {};
    if (secret) headers['Authorization'] = `Bearer ${secret}`;
    const res = await fetch(`${url}/health`, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    return {
      configured: true,
      ok: res.ok,
      status: res.status,
      message: res.ok ? 'Gateway OK' : `HTTP ${res.status}`,
    };
  } catch (e: any) {
    return {
      configured: true,
      ok: false,
      message: e?.message || 'Falha ao pingar gateway',
    };
  }
}
