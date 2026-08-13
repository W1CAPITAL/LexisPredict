/**
 * Preferências de menu por usuário (localStorage).
 * Ocultar, reordenar e fixar abas (independente de "Mais ferramentas").
 */

export type NavPreferences = {
  /** hrefs ocultos */
  hidden: string[];
  /** ordem global das abas (lista plana) */
  order: string[];
  /**
   * Abas que aparecem sempre, mesmo com "Mais ferramentas" desligado.
   * Serve para tirar um item do bloco secundário e deixá-lo no menu principal.
   */
  pinned: string[];
};

const KEY_PREFIX = 'lexis_nav_prefs_v1:';

export const DEFAULT_NAV_PREFS: NavPreferences = {
  hidden: [],
  order: [],
  pinned: [],
};

function storageKey(userId?: string | null) {
  return `${KEY_PREFIX}${userId || 'anon'}`;
}

export function loadNavPreferences(userId?: string | null): NavPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_NAV_PREFS };
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { ...DEFAULT_NAV_PREFS };
    const parsed = JSON.parse(raw);
    return {
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden.map(String) : [],
      order: Array.isArray(parsed.order) ? parsed.order.map(String) : [],
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned.map(String) : [],
    };
  } catch {
    return { ...DEFAULT_NAV_PREFS };
  }
}

export function saveNavPreferences(
  partial: Partial<NavPreferences>,
  userId?: string | null
) {
  if (typeof window === 'undefined') return;
  const next = { ...loadNavPreferences(userId), ...partial };
  localStorage.setItem(storageKey(userId), JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent('lexis-nav-prefs', { detail: { ...next, userId } })
  );
}

export type NavItemLike = { href: string; label: string; [k: string]: any };
export type NavGroupLike = { title: string; items: NavItemLike[] };

/**
 * Junta todos os itens numa lista plana, aplica hide/order/pinned.
 * `secondaryHrefs` = itens do bloco "Mais ferramentas".
 * Se showSecondary=false, só entram secondary se estiverem em pinned.
 */
export function flattenNavItems<T extends NavItemLike>(
  primary: T[],
  secondary: T[],
  rest: T[],
  prefs: NavPreferences,
  showSecondary: boolean
): T[] {
  const hidden = new Set((prefs.hidden || []).map(String));
  const pinned = new Set((prefs.pinned || []).map(String));
  const order = prefs.order || [];

  const sec = showSecondary
    ? secondary
    : secondary.filter((it) => pinned.has(String(it.href)));

  // dedupe por href (pinned pode já estar em primary)
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const it of [...primary, ...sec, ...rest]) {
    const h = String(it.href);
    if (hidden.has(h) || seen.has(h)) continue;
    seen.add(h);
    merged.push(it);
  }

  if (!order.length) return merged;

  const rank = (href: string) => {
    const i = order.indexOf(href);
    return i === -1 ? 5000 + href.length : i;
  };
  return [...merged].sort((a, b) => rank(String(a.href)) - rank(String(b.href)));
}

/** @deprecated use flattenNavItems — mantido para imports antigos */
export function applyNavPreferences<T extends NavGroupLike>(
  groups: T[],
  prefs: NavPreferences
): T[] {
  const hidden = new Set((prefs.hidden || []).map(String));
  const order = prefs.order || [];
  return groups
    .map((g) => {
      let items = (g.items || []).filter((it) => !hidden.has(String(it.href)));
      if (order.length) {
        const rank = (href: string) => {
          const i = order.indexOf(href);
          return i === -1 ? 1000 + href.length : i;
        };
        items = [...items].sort((a, b) => rank(a.href) - rank(b.href));
      }
      return { ...g, items };
    })
    .filter((g) => (g.items || []).length > 0) as T[];
}

/** Catálogo plano (configurações). moreTools=true → bloco "Mais ferramentas" */
export const NAV_CATALOG: {
  href: string;
  label: string;
  group: string;
  moreTools?: boolean;
}[] = [
  { href: '/', label: 'Painel', group: 'Principal' },
  { href: '/tarefas', label: 'Fila de contato', group: 'Principal' },
  { href: '/cases', label: 'Meus processos', group: 'Principal' },
  { href: '/processos', label: 'Visão da empresa', group: 'Principal' },
  { href: '/import', label: 'Importar', group: 'Principal' },
  { href: '/tools/automacao', label: 'Cadastro', group: 'Principal' },
  { href: '/agenda', label: 'Agenda', group: 'Ferramentas', moreTools: true },
  { href: '/busca-apreensao', label: 'Busca e apreensão', group: 'Ferramentas', moreTools: true },
  { href: '/report', label: 'Dossiê', group: 'Ferramentas', moreTools: true },
  { href: '/tools/ocr', label: 'OCR', group: 'Ferramentas', moreTools: true },
  { href: '/crm', label: 'CRM Assessoria', group: 'Ferramentas', moreTools: true },
  { href: '/crm/followups', label: 'Follow-ups CRM', group: 'Ferramentas', moreTools: true },
  { href: '/financas', label: 'Finanças', group: 'Ferramentas', moreTools: true },
  { href: '/modelos', label: 'Modelos', group: 'Ferramentas', moreTools: true },
  { href: '/documents', label: 'Documentos', group: 'Ferramentas', moreTools: true },
  { href: '/substabelecimento', label: 'Substabelecimento', group: 'Ferramentas', moreTools: true },
  { href: '/habilitacao-peca', label: 'Habilitação', group: 'Ferramentas', moreTools: true },
  { href: '/veredito', label: 'Veredito', group: 'Ferramentas', moreTools: true },
  { href: '/chat', label: 'Assistente', group: 'Ferramentas', moreTools: true },
  { href: '/whatsapp', label: 'WhatsApp', group: 'Ferramentas', moreTools: true },
  { href: '/analytics', label: 'Indicadores', group: 'Ferramentas', moreTools: true },
  { href: '/insights', label: 'IA Preditiva', group: 'Ferramentas', moreTools: true },
  { href: '/urgency', label: 'Urgências', group: 'Ferramentas', moreTools: true },
  { href: '/supervisao', label: 'Supervisão', group: 'Gestão' },
  { href: '/team', label: 'Equipe', group: 'Gestão' },
  { href: '/auditoria', label: 'Auditoria', group: 'Gestão' },
  { href: '/security', label: 'Segurança', group: 'Gestão' },
  { href: '/onboarding', label: 'Treinamento', group: 'Sistema' },
  { href: '/notes', label: 'Notas', group: 'Sistema' },
  { href: '/settings', label: 'Configurações', group: 'Sistema' },
];
