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
