/**
 * MOTOR DE TEMAS — presets legíveis (contraste WCAG-friendly), sem cansar a vista.
 * Cada tema possui variantes Light e Dark e funciona com ou sem modo escuro.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { getIdealTextColor, getIdealMutedTextColor, getContrastRatio } from './utils';

export type ThemeColors = {
  background: string;
  bgSecondary: string;
  foreground: string;
  fontMuted: string;
  primary: string;
  accent: string;
  border: string;
};

export type ThemeMode = 'light' | 'dark';

export type ThemePair = {
  light: ThemeColors;
  dark: ThemeColors;
};

export type ThemePreset = {
  id: string;
  name: string;
  radius: number;
  /** dica curta na UI de settings */
  hint?: string;
  /** paletas por modo (claro/escuro) */
  colors: ThemePair;
};

export function getPresetColors(preset: ThemePreset, mode: ThemeMode): ThemeColors {
  return preset.colors[mode] || preset.colors.light;
}

function normalize(hex: string): string {
  if (!hex || hex[0] !== '#') return '#000000';
  const h = hex.replace(/^#/, '');
  if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  return `#${h.slice(0, 6)}`;
}

function blend(hexA: string, hexB: string, t: number): string {
  const a = parseInt(normalize(hexA).slice(1), 16);
  const b = parseInt(normalize(hexB).slice(1), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

/**
 * Paletas testadas para texto legível em jornada longa.
 * Cada preset tem variante clara e escura com contraste WCAG-safe.
 */
export const AUTHORITY_PRESETS: ThemePreset[] = [
  {
    id: 'minimal-steel',
    name: 'Minimal Steel',
    radius: 8,
    hint: 'Claro/escuro azul suave — padrão operacional',
    colors: {
      light: {
        background: '#F8FAFC', bgSecondary: '#FFFFFF', foreground: '#0F172A',
        fontMuted: '#475569', primary: '#2563EB', accent: '#E2E8F0', border: '#CBD5E1',
      },
      dark: {
        background: '#0B1220', bgSecondary: '#111827', foreground: '#F1F5F9',
        fontMuted: '#94A3B8', primary: '#60A5FA', accent: '#1E293B', border: '#334155',
      },
    },
  },
  {
    id: 'paper-legal',
    name: 'Papel Jurídico',
    radius: 6,
    hint: 'Off-white quente, baixo cansaço visual',
    colors: {
      light: {
        background: '#FAF8F5', bgSecondary: '#FFFFFF', foreground: '#1C1917',
        fontMuted: '#57534E', primary: '#1E3A5F', accent: '#E7E5E4', border: '#D6D3D1',
      },
      dark: {
        background: '#181512', bgSecondary: '#211D19', foreground: '#F5F2EE',
        fontMuted: '#A8A29E', primary: '#9DC0E8', accent: '#2A2520', border: '#3F3A35',
      },
    },
  },
  {
    id: 'slate-calm',
    name: 'Slate Calmo',
    radius: 10,
    hint: 'Cinza frio profissional',
    colors: {
      light: {
        background: '#F1F5F9', bgSecondary: '#FFFFFF', foreground: '#0F172A',
        fontMuted: '#64748B', primary: '#0F766E', accent: '#E2E8F0', border: '#CBD5E1',
      },
      dark: {
        background: '#0F172A', bgSecondary: '#1E293B', foreground: '#F1F5F9',
        fontMuted: '#94A3B8', primary: '#2DD4BF', accent: '#273449', border: '#334155',
      },
    },
  },
  {
    id: 'night-ops',
    name: 'Night Ops',
    radius: 10,
    hint: 'Escuro para turnos longos — contraste alto',
    colors: {
      light: {
        background: '#EEF2F7', bgSecondary: '#FFFFFF', foreground: '#0B1220',
        fontMuted: '#475569', primary: '#0369A1', accent: '#E2E8F0', border: '#CBD5E1',
      },
      dark: {
        background: '#0B1220', bgSecondary: '#111827', foreground: '#F1F5F9',
        fontMuted: '#94A3B8', primary: '#38BDF8', accent: '#1E293B', border: '#334155',
      },
    },
  },
  {
    id: 'graphite',
    name: 'Grafite',
    radius: 8,
    hint: 'Neutro quase preto, toque lime',
    colors: {
      light: {
        background: '#F4F4F5', bgSecondary: '#FFFFFF', foreground: '#18181B',
        fontMuted: '#52525B', primary: '#4D7C0F', accent: '#E4E4E7', border: '#D4D4D8',
      },
      dark: {
        background: '#121212', bgSecondary: '#1E1E1E', foreground: '#FAFAFA',
        fontMuted: '#A3A3A3', primary: '#A3E635', accent: '#2A2A2A', border: '#404040',
      },
    },
  },
  {
    id: 'sand-focus',
    name: 'Areia Foco',
    radius: 12,
    hint: 'Tom areia, primary terra',
    colors: {
      light: {
        background: '#F5F0E8', bgSecondary: '#FFFBF5', foreground: '#292524',
        fontMuted: '#78716C', primary: '#B45309', accent: '#E7E5E4', border: '#D6D3D1',
      },
      dark: {
        background: '#1C1917', bgSecondary: '#26221E', foreground: '#FAF9F7',
        fontMuted: '#A8A29E', primary: '#F59E0B', accent: '#2F2A24', border: '#44403C',
      },
    },
  },
  {
    id: 'white-prestige',
    name: 'White Prestige',
    radius: 4,
    hint: 'Alto contraste preto/branco (impressão mental)',
    colors: {
      light: {
        background: '#F3F2F2', bgSecondary: '#FFFFFF', foreground: '#000000',
        fontMuted: '#4B5563', primary: '#111111', accent: '#E5E7EB', border: '#D1D5DB',
      },
      dark: {
        background: '#0A0A0A', bgSecondary: '#161616', foreground: '#FFFFFF',
        fontMuted: '#A1A1AA', primary: '#E4E4E7', accent: '#232323', border: '#3F3F46',
      },
    },
  },
  {
    id: 'esmeralda',
    name: 'Esmeralda',
    radius: 10,
    hint: 'Verde institucional — confiança e foco',
    colors: {
      light: {
        background: '#F0FDF4', bgSecondary: '#FFFFFF', foreground: '#052E16',
        fontMuted: '#3F6212', primary: '#16A34A', accent: '#DCFCE7', border: '#BBF7D0',
      },
      dark: {
        background: '#052E16', bgSecondary: '#0A3D1E', foreground: '#ECFDF5',
        fontMuted: '#86EFAC', primary: '#4ADE80', accent: '#0E4A24', border: '#166534',
      },
    },
  },
  {
    id: 'violeta',
    name: 'Violeta',
    radius: 12,
    hint: 'Amethyst — criativo e premium',
    colors: {
      light: {
        background: '#FAF5FF', bgSecondary: '#FFFFFF', foreground: '#2E1065',
        fontMuted: '#6B21A8', primary: '#7C3AED', accent: '#F3E8FF', border: '#E9D5FF',
      },
      dark: {
        background: '#1E1037', bgSecondary: '#2A1850', foreground: '#F5F3FF',
        fontMuted: '#C4B5FD', primary: '#A78BFA', accent: '#331A5C', border: '#4C1D95',
      },
    },
  },
  {
    id: 'rose-gold',
    name: 'Rosé Gold',
    radius: 14,
    hint: 'Tom rosé quente — moderno',
    colors: {
      light: {
        background: '#FFF7F7', bgSecondary: '#FFFFFF', foreground: '#4C0519',
        fontMuted: '#9F5A68', primary: '#E11D48', accent: '#FFE4E6', border: '#FECDD3',
      },
      dark: {
        background: '#250711', bgSecondary: '#32091A', foreground: '#FFF1F2',
        fontMuted: '#FDA4AF', primary: '#FB7185', accent: '#3B0A1B', border: '#881337',
      },
    },
  },
  {
    id: 'solar',
    name: 'Solar',
    radius: 12,
    hint: 'Âmbar — energia e alerta positivo',
    colors: {
      light: {
        background: '#FFFBEB', bgSecondary: '#FFFFFF', foreground: '#451A03',
        fontMuted: '#92400E', primary: '#D97706', accent: '#FEF3C7', border: '#FDE68A',
      },
      dark: {
        background: '#1C1004', bgSecondary: '#261606', foreground: '#FFFBEB',
        fontMuted: '#E6C98A', primary: '#F59E0B', accent: '#2E1A07', border: '#78350F',
      },
    },
  },
  {
    id: 'ocean',
    name: 'Ocean Deep',
    radius: 10,
    hint: 'Azul profundo — corporativo digital',
    colors: {
      light: {
        background: '#F0F9FF', bgSecondary: '#FFFFFF', foreground: '#082F49',
        fontMuted: '#4A7A99', primary: '#0284C7', accent: '#E0F2FE', border: '#BAE6FD',
      },
      dark: {
        background: '#082F49', bgSecondary: '#0C3E5E', foreground: '#F0F9FF',
        fontMuted: '#7DD3FC', primary: '#38BDF8', accent: '#10486E', border: '#155E8A',
      },
    },
  },
  {
    id: 'nord',
    name: 'Nord Frost',
    radius: 8,
    hint: 'Frost escandinavo — sereno e nítido',
    colors: {
      light: {
        background: '#ECEFF4', bgSecondary: '#FFFFFF', foreground: '#2E3440',
        fontMuted: '#4C566A', primary: '#5E81AC', accent: '#E5E9F0', border: '#D8DEE9',
      },
      dark: {
        background: '#2E3440', bgSecondary: '#3B4252', foreground: '#ECEFF4',
        fontMuted: '#D8DEE9', primary: '#88C0D0', accent: '#434C5E', border: '#4C566A',
      },
    },
  },
  {
    id: 'mocha',
    name: 'Mocha',
    radius: 10,
    hint: 'Café cremoso — acolhedor',
    colors: {
      light: {
        background: '#FAF6F0', bgSecondary: '#FFFFFF', foreground: '#2B1B0E',
        fontMuted: '#7A6248', primary: '#7B4B24', accent: '#F0E4D3', border: '#E0CDB4',
      },
      dark: {
        background: '#1B120B', bgSecondary: '#261A10', foreground: '#F7F0E6',
        fontMuted: '#C9A87C', primary: '#D8A05C', accent: '#2E2116', border: '#4A3A2A',
      },
    },
  },
];

const PRESET_STORAGE_KEY = 'lexisPredict_theme_preset';
const CUSTOM_THEME_KEY = 'lexisPredict_custom_theme';
export const CUSTOM_PRESET_ID = 'custom-hardware';

export function getSavedPresetId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(PRESET_STORAGE_KEY);
}

/** Salva as cores customizadas do Hardware como um "preset" persistente (funciona em light e dark). */
export function saveCustomTheme(colors: ThemeColors, radius: number) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(PRESET_STORAGE_KEY, CUSTOM_PRESET_ID);
  localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify({ radius, colors }));
}

export function applyStoredCustom(mode?: ThemeMode): boolean {
  if (typeof localStorage === 'undefined') return false;
  const raw = localStorage.getItem(CUSTOM_THEME_KEY);
  if (!raw) return false;
  try {
    const { radius, colors } = JSON.parse(raw);
    applyGlobalTheme(colors, radius, undefined, undefined, undefined, mode);
    return true;
  } catch {
    return false;
  }
}

export function getCurrentMode(): ThemeMode {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function hexToHsl(hex: string): string {
  if (!hex || hex[0] !== '#') return '0 0% 0%';
  const cleanHex = hex.replace(/^#/, '');
  let r =
    parseInt(
      cleanHex.length === 3 ? cleanHex[0] + cleanHex[0] : cleanHex.slice(0, 2),
      16
    ) / 255;
  let g =
    parseInt(
      cleanHex.length === 3 ? cleanHex[1] + cleanHex[1] : cleanHex.slice(2, 4),
      16
    ) / 255;
  let b =
    parseInt(
      cleanHex.length === 3 ? cleanHex[2] + cleanHex[2] : cleanHex.slice(4, 6),
      16
    ) / 255;

  let max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;

  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Remove overrides inline para voltar ao tema padrão Orbit (sem preset). */
export function clearCustomTheme() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const props = [
    '--background', '--card', '--popover', '--secondary', '--foreground',
    '--card-foreground', '--muted', '--muted-foreground', '--primary',
    '--primary-foreground', '--accent', '--accent-foreground', '--border',
    '--input', '--ring', '--radius', '--destructive', '--success', '--warning',
    '--sidebar-background', '--sidebar-foreground', '--sidebar-border',
    '--sidebar-primary', '--sidebar-accent', '--chart-1', '--chart-2',
    '--chart-3', '--chart-4', '--chart-5',
  ];
  props.forEach((p) => root.style.removeProperty(p));
  root.removeAttribute('data-lexis-preset');
  window.dispatchEvent(new Event('lexis-theme-changed'));
}

const CHART_HUES: Record<ThemeMode, { success: string; warning: string; destructive: string }> = {
  light: { success: '#059669', warning: '#D97706', destructive: '#DC2626' },
  dark: { success: '#34D399', warning: '#FBBF24', destructive: '#F87171' },
};

/** Deriva cores de gráfico a partir do hue do primary mantendo harmonia. */
function deriveCharts(primary: string, mode: ThemeMode): string[] {
  const baseHue = parseInt(hexToHsl(primary).split(' ')[0], 10);
  const sat = mode === 'light' ? '72%' : '68%';
  const lums = mode === 'light' ? ['52%', '62%', '45%', '68%', '38%'] : ['58%', '66%', '50%', '74%', '42%'];
  const deltas = [0, 60, 180, 240, 300];
  return deltas.map((d, i) => `${(baseHue + d) % 360} ${sat} ${lums[i]}`);
}

export function applyGlobalTheme(
  colors: ThemeColors,
  radius: number,
  bgOpacity?: number,
  sidebarOpacity?: number,
  glassBlur?: number,
  mode?: ThemeMode
) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const m: ThemeMode = mode || getCurrentMode();
  const isLight = m === 'light';

  let finalForeground = colors.foreground;
  if (getContrastRatio(colors.background, colors.foreground) < 4.5) {
    finalForeground = getIdealTextColor(colors.background);
  }

  let finalMuted = colors.fontMuted;
  if (getContrastRatio(colors.background, colors.fontMuted) < 3.0) {
    finalMuted = getIdealMutedTextColor(colors.background);
  }

  const primary = normalize(colors.primary);
  const onPrimary = getContrastRatio(primary, '#FFFFFF') >= 3.0 ? '#FFFFFF' : '#0F172A';
  const sem = CHART_HUES[m];

  localStorage.setItem('lexisPredict_bg_color', colors.background);
  localStorage.setItem('lexisPredict_bg_secondary_color', colors.bgSecondary);
  localStorage.setItem('lexisPredict_font_color', finalForeground);
  localStorage.setItem('lexisPredict_font_muted_color', finalMuted);
  localStorage.setItem('lexisPredict_btn_bg_color', colors.primary);
  localStorage.setItem('lexisPredict_btn_inactive_color', colors.accent);
  localStorage.setItem('lexisPredict_border_color', colors.border);
  localStorage.setItem('lexisPredict_border_radius', radius.toString());

  if (bgOpacity !== undefined) localStorage.setItem('lexisPredict_bg_opacity', bgOpacity.toString());
  if (sidebarOpacity !== undefined)
    localStorage.setItem('lexisPredict_sidebar_opacity', sidebarOpacity.toString());
  if (glassBlur !== undefined) localStorage.setItem('lexisPredict_glass_blur', glassBlur.toString());

  root.style.setProperty('--background', hexToHsl(colors.background));
  root.style.setProperty('--card', hexToHsl(colors.bgSecondary));
  root.style.setProperty('--popover', hexToHsl(colors.bgSecondary));
  root.style.setProperty('--secondary', hexToHsl(colors.bgSecondary));
  root.style.setProperty('--muted', hexToHsl(isLight ? colors.accent : blend(colors.bgSecondary, '#000000', 0.12)));
  root.style.setProperty('--foreground', hexToHsl(finalForeground));
  root.style.setProperty('--card-foreground', hexToHsl(finalForeground));
  root.style.setProperty('--popover-foreground', hexToHsl(finalForeground));
  root.style.setProperty('--secondary-foreground', hexToHsl(finalForeground));
  root.style.setProperty('--muted-foreground', hexToHsl(finalMuted));
  root.style.setProperty('--primary', hexToHsl(primary));
  root.style.setProperty('--primary-foreground', hexToHsl(onPrimary));
  root.style.setProperty('--accent', hexToHsl(colors.accent));
  root.style.setProperty('--accent-foreground', hexToHsl(finalForeground));
  root.style.setProperty('--border', hexToHsl(colors.border));
  root.style.setProperty('--input', hexToHsl(colors.border));
  root.style.setProperty('--ring', hexToHsl(primary));
  root.style.setProperty('--radius', `${radius}px`);

  root.style.setProperty('--destructive', hexToHsl(sem.destructive));
  root.style.setProperty('--destructive-foreground', hexToHsl(isLight ? '#FFFFFF' : '#0F172A'));
  root.style.setProperty('--success', hexToHsl(sem.success));
  root.style.setProperty('--success-foreground', hexToHsl(isLight ? '#FFFFFF' : '#0F172A'));
  root.style.setProperty('--warning', hexToHsl(sem.warning));
  root.style.setProperty('--warning-foreground', hexToHsl(isLight ? '#FFFFFF' : '#0F172A'));

  const charts = deriveCharts(primary, m);
  charts.forEach((c, i) => root.style.setProperty(`--chart-${i + 1}`, c));

  root.style.setProperty('--sidebar-background', hexToHsl(colors.bgSecondary));
  root.style.setProperty('--sidebar-foreground', hexToHsl(finalForeground));
  root.style.setProperty('--sidebar-border', hexToHsl(colors.border));
  root.style.setProperty('--sidebar-primary', hexToHsl(primary));
  root.style.setProperty('--sidebar-primary-foreground', hexToHsl(onPrimary));
  root.style.setProperty('--sidebar-accent', hexToHsl(colors.accent));
  root.style.setProperty('--sidebar-accent-foreground', hexToHsl(finalForeground));
  root.style.setProperty('--sidebar-ring', hexToHsl(primary));

  if (bgOpacity !== undefined) root.style.setProperty('--bg-opacity', bgOpacity.toString());
  if (sidebarOpacity !== undefined)
    root.style.setProperty('--sidebar-opacity', sidebarOpacity.toString());
  if (glassBlur !== undefined) root.style.setProperty('--glass-blur', `${glassBlur}px`);

  root.setAttribute('data-lexis-preset', 'custom');
  window.dispatchEvent(new Event('lexis-theme-changed'));
}

export function applyPresetById(id: string, mode?: ThemeMode) {
  const preset = AUTHORITY_PRESETS.find((p) => p.id === id) || null;
  if (!preset) {
    localStorage.removeItem(PRESET_STORAGE_KEY);
    localStorage.removeItem(CUSTOM_THEME_KEY);
    clearCustomTheme();
    return null;
  }
  const m: ThemeMode = mode || getCurrentMode();
  applyGlobalTheme(getPresetColors(preset, m), preset.radius, undefined, undefined, undefined, m);
  localStorage.setItem(PRESET_STORAGE_KEY, preset.id);
  localStorage.removeItem(CUSTOM_THEME_KEY);
  return preset;
}

/** Aplica o preset salvo (ou limpa) conforme o modo atual — usado no boot e ao trocar modo. */
export function applySavedPreset(mode?: ThemeMode) {
  const m: ThemeMode = mode || getCurrentMode();
  const saved = getSavedPresetId();
  if (!saved) {
    clearCustomTheme();
    return;
  }
  if (saved === CUSTOM_PRESET_ID) {
    if (!applyStoredCustom(m)) clearCustomTheme();
    return;
  }
  applyPresetById(saved, m);
}
