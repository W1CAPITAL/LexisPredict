/**
 * Preferências de menu por usuário (localStorage).
 * Ocultar abas, reordenar itens do sidebar.
 */

export type NavPreferences = {
  /** hrefs ocultos, ex: ["/analytics", "/notes"] */
  hidden: string[];
  /** ordem customizada de hrefs (os que não listados ficam no fim na ordem original) */
  order: string[];
};

const KEY_PREFIX = 'lexis_nav_prefs_v1:';

export const DEFAULT_NAV_PREFS: NavPreferences = {
  hidden: [],
  order: [],
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

/** Aplica hide + order aos grupos do sidebar */
export function applyNavPreferences<T extends NavGroupLike>(
  groups: T[],
  prefs: NavPreferences
): T[] {
  const hidden = new Set((prefs.hidden || []).map(String));
  const order = prefs.order || [];

  const mapGroup = (g: T): T => {
    let items = (g.items || []).filter((it) => !hidden.has(String(it.href)));
    if (order.length) {
      const rank = (href: string) => {
        const i = order.indexOf(href);
        return i === -1 ? 1000 + href.length : i;
      };
      items = [...items].sort((a, b) => rank(a.href) - rank(b.href));
    }
    return { ...g, items };
  };

  return groups
    .map(mapGroup)
    .filter((g) => (g.items || []).length > 0) as T[];
}

/** Catálogo plano de abas conhecidas (para a UI de config) */
export const NAV_CATALOG: { href: string; label: string; group: string }[] = [
  { href: '/', label: 'Painel', group: 'Hoje' },
  { href: '/tarefas', label: 'Fila de contato', group: 'Hoje' },
  { href: '/cases', label: 'Meus processos', group: 'Hoje' },
  { href: '/processos', label: 'Visão da empresa', group: 'Carteira' },
  { href: '/import', label: 'Importar', group: 'Carteira' },
  { href: '/cadastro', label: 'Cadastro', group: 'Carteira' },
  { href: '/whatsapp', label: 'WhatsApp', group: 'Ferramentas' },
  { href: '/agenda', label: 'Agenda', group: 'Ferramentas' },
  { href: '/veredito', label: 'Veredito', group: 'Ferramentas' },
  { href: '/chat', label: 'Assistente', group: 'Ferramentas' },
  { href: '/documents', label: 'Documentos', group: 'Ferramentas' },
  { href: '/modelos', label: 'Modelos', group: 'Ferramentas' },
  { href: '/analytics', label: 'Indicadores', group: 'Números' },
  { href: '/insights', label: 'IA Preditiva', group: 'Números' },
  { href: '/urgency', label: 'Urgências', group: 'Números' },
  { href: '/supervisao', label: 'Supervisão', group: 'Gestão' },
  { href: '/team', label: 'Equipe', group: 'Gestão' },
  { href: '/auditoria', label: 'Auditoria', group: 'Gestão' },
  { href: '/notes', label: 'Notas', group: 'Ajuda' },
  { href: '/onboarding', label: 'Treinamento', group: 'Ajuda' },
  { href: '/settings', label: 'Configurações', group: 'Ajuda' },
];
