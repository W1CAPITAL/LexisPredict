/**
 * Links oficiais WhatsApp (Meta) — sem API, sem bridge.
 * Web / PWA / Android (Chrome) / iOS (Safari) via URL schemes.
 */

export type WhatsAppLinkOptions = {
  /** Telefone com DDI (ex: 5511999999999) — só dígitos */
  phone: string;
  /** Texto pré-preenchido */
  text?: string;
};

/** Normaliza para E.164 sem + (DDI 55 se BR 10/11 dígitos) */
export function normalizeWhatsAppPhone(phone: string): string {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d;
}

/**
 * Universal / Web — preferido.
 * https://wa.me/5511...?text=
 * (equivalente estável a api.whatsapp.com/send)
 */
export function buildWaMeLink({ phone, text }: WhatsAppLinkOptions): string {
  const n = normalizeWhatsAppPhone(phone);
  const base = `https://wa.me/${n}`;
  if (!text?.trim()) return base;
  return `${base}?text=${encodeURIComponent(text.trim())}`;
}

/**
 * Endpoint legado oficial ainda documentado pela Meta.
 * https://api.whatsapp.com/send?phone=&text=
 */
export function buildApiWhatsAppSendLink({ phone, text }: WhatsAppLinkOptions): string {
  const n = normalizeWhatsAppPhone(phone);
  const params = new URLSearchParams();
  params.set('phone', n);
  if (text?.trim()) params.set('text', text.trim());
  return `https://api.whatsapp.com/send?${params.toString()}`;
}

/**
 * Scheme nativo (mobile). No browser, se o app estiver instalado, o SO pode abrir o WA.
 * iOS/Android: whatsapp://send?phone=&text=
 */
export function buildWhatsAppSchemeLink({ phone, text }: WhatsAppLinkOptions): string {
  const n = normalizeWhatsAppPhone(phone);
  const params = new URLSearchParams();
  params.set('phone', n);
  if (text?.trim()) params.set('text', text.trim());
  return `whatsapp://send?${params.toString()}`;
}

/**
 * Escolhe o melhor link no browser:
 * - mobile: tenta scheme + fallback wa.me
 * - desktop: wa.me
 */
export function buildBestWhatsAppOpenLink(
  opts: WhatsAppLinkOptions,
  env?: { isMobile?: boolean }
): { primary: string; fallback: string; scheme: string } {
  const waMe = buildWaMeLink(opts);
  const api = buildApiWhatsAppSendLink(opts);
  const scheme = buildWhatsAppSchemeLink(opts);
  const isMobile =
    env?.isMobile ??
    (typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ''));

  return {
    primary: isMobile ? scheme : waMe,
    fallback: waMe,
    scheme,
  };
}

/**
 * Abre WhatsApp no cliente (browser).
 * Mobile: tenta scheme; se falhar, wa.me.
 * Desktop: wa.me em nova aba.
 */
export function openWhatsAppClient(opts: WhatsAppLinkOptions): void {
  if (typeof window === 'undefined') return;
  const { primary, fallback } = buildBestWhatsAppOpenLink(opts);
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

  if (isMobile && primary.startsWith('whatsapp://')) {
    const start = Date.now();
    window.location.href = primary;
    // Fallback se o scheme não abriu o app
    window.setTimeout(() => {
      if (Date.now() - start < 1500) {
        window.open(fallback, '_blank', 'noopener,noreferrer');
      }
    }, 800);
    return;
  }

  window.open(fallback, '_blank', 'noopener,noreferrer');
}


/**
 * WhatsApp Web no navegador que o operador já usa.
 * Exige sessão iniciada em web.whatsapp.com e envio MANUAL após revisão.
 * Não é uma API e não confirma delivery, leitura ou registro de atendimento.
 */
export function buildWhatsAppWebSendLink(opts: WhatsAppLinkOptions): string {
  const phone = normalizeWhatsAppPhone(opts.phone);
  // E.164 sem +: 8 a 15 dígitos. Rejeita números malformados.
  if (!/^[1-9]\d{7,14}$/.test(phone)) {
    throw new Error('Número inválido para WhatsApp Web. Cadastre telefone com DDD e DDI.');
  }
  const params = new URLSearchParams({phone});
  if (opts.text?.trim()) params.set('text', opts.text.trim().slice(0,4096));
  return 'https://web.whatsapp.com/send?' + params.toString();
}

export function openWhatsAppWebClient(opts:WhatsAppLinkOptions): boolean {
  if(typeof window==='undefined')return false;
  const url=buildWhatsAppWebSendLink(opts);
  // Abre no gesto do clique, detecta bloqueador de popup e desativa o opener
  // antes de permitir que a página de destino utilize a aba.
  const tab=window.open('about:blank','_blank');
  if(!tab)return false;
  try{tab.opener=null;tab.location.replace(url);}
  catch{tab.close();return false;}
  return true;
}
