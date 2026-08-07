/**
 * Preferências visuais amplas (localStorage) — partículas, densidade, motion, etc.
 * Não quebra layout se ausente.
 */

export type UiPreferences = {
  particles: boolean;
  reducedMotion: boolean;
  compactMode: boolean;
  cardRadius: 'sharp' | 'rounded' | 'pill';
  density: 'comfortable' | 'compact' | 'spacious';
  sidebarCollapsedDefault: boolean;
  showMeritCounters: boolean;
  showRiskGauge: boolean;
  accentOverride: string | null;
  fontScale: number; // 0.9–1.15
};

export const DEFAULT_UI_PREFS: UiPreferences = {
  particles: false,
  reducedMotion: false,
  compactMode: false,
  cardRadius: 'rounded',
  density: 'comfortable',
  sidebarCollapsedDefault: false,
  showMeritCounters: true,
  showRiskGauge: true,
  accentOverride: null,
  fontScale: 1,
};

const KEY = 'lexis_ui_prefs_v1';

export function loadUiPreferences(): UiPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_UI_PREFS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_UI_PREFS };
    return { ...DEFAULT_UI_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_UI_PREFS };
  }
}

export function saveUiPreferences(p: Partial<UiPreferences>) {
  if (typeof window === 'undefined') return;
  const next = { ...loadUiPreferences(), ...p };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('lexis-ui-prefs', { detail: next }));
  applyUiPreferencesToDom(next);
}

export function applyUiPreferencesToDom(p: UiPreferences = loadUiPreferences()) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.particles = p.particles ? '1' : '0';
  root.dataset.reducedMotion = p.reducedMotion ? '1' : '0';
  root.dataset.density = p.density;
  root.dataset.cardRadius = p.cardRadius;
  root.style.setProperty('--lexis-font-scale', String(p.fontScale));
  if (p.accentOverride) root.style.setProperty('--primary', p.accentOverride);
}
