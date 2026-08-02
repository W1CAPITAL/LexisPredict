/**
 * MOTOR DE TEMAS — presets legíveis (contraste WCAG-friendly), sem cansar a vista.
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

export type ThemePreset = {
  id: string;
  name: string;
  colors: ThemeColors;
  radius: number;
  /** dica curta na UI de settings */
  hint?: string;
};

/**
 * Paletas testadas para texto legível em jornada longa.
 * Evitar primaries neon extremos e fundos cinza médio com texto cinza.
 */
export const AUTHORITY_PRESETS: ThemePreset[] = [
  {
    id: 'minimal-steel',
    name: 'Minimal Steel',
    radius: 8,
    hint: 'Claro, azul suave — padrão operacional',
    colors: {
      background: '#F8FAFC',
      bgSecondary: '#FFFFFF',
      foreground: '#0F172A',
      fontMuted: '#475569',
      primary: '#2563EB',
      accent: '#E2E8F0',
      border: '#CBD5E1',
    },
  },
  {
    id: 'paper-legal',
    name: 'Papel Jurídico',
    radius: 6,
    hint: 'Off-white quente, baixo cansaço visual',
    colors: {
      background: '#FAF8F5',
      bgSecondary: '#FFFFFF',
      foreground: '#1C1917',
      fontMuted: '#57534E',
      primary: '#1E3A5F',
      accent: '#E7E5E4',
      border: '#D6D3D1',
    },
  },
  {
    id: 'slate-calm',
    name: 'Slate Calmo',
    radius: 10,
    hint: 'Cinza frio profissional',
    colors: {
      background: '#F1F5F9',
      bgSecondary: '#FFFFFF',
      foreground: '#0F172A',
      fontMuted: '#64748B',
      primary: '#0F766E',
      accent: '#E2E8F0',
      border: '#CBD5E1',
    },
  },
  {
    id: 'night-ops',
    name: 'Night Ops',
    radius: 10,
    hint: 'Escuro para turnos longos — contraste alto',
    colors: {
      background: '#0B1220',
      bgSecondary: '#111827',
      foreground: '#F1F5F9',
      fontMuted: '#94A3B8',
      primary: '#38BDF8',
      accent: '#1E293B',
      border: '#334155',
    },
  },
  {
    id: 'graphite',
    name: 'Grafite',
    radius: 8,
    hint: 'Escuro neutro, menos azul',
    colors: {
      background: '#121212',
      bgSecondary: '#1E1E1E',
      foreground: '#FAFAFA',
      fontMuted: '#A3A3A3',
      primary: '#A3E635',
      accent: '#2A2A2A',
      border: '#404040',
    },
  },
  {
    id: 'sand-focus',
    name: 'Areia Foco',
    radius: 12,
    hint: 'Tom areia, primary terra',
    colors: {
      background: '#F5F0E8',
      bgSecondary: '#FFFBF5',
      foreground: '#292524',
      fontMuted: '#78716C',
      primary: '#B45309',
      accent: '#E7E5E4',
      border: '#D6D3D1',
    },
  },
  {
    id: 'white-prestige',
    name: 'White Prestige',
    radius: 4,
    hint: 'Alto contraste preto/branco (impressão mental)',
    colors: {
      background: '#F3F2F2',
      bgSecondary: '#FFFFFF',
      foreground: '#000000',
      fontMuted: '#4B5563',
      primary: '#111111',
      accent: '#E5E7EB',
      border: '#D1D5DB',
    },
  },
];

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

export function applyGlobalTheme(
  colors: ThemeColors,
  radius: number,
  bgOpacity?: number,
  sidebarOpacity?: number,
  glassBlur?: number
) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  let finalForeground = colors.foreground;
  if (getContrastRatio(colors.background, colors.foreground) < 4.5) {
    finalForeground = getIdealTextColor(colors.background);
  }

  let finalMuted = colors.fontMuted;
  if (getContrastRatio(colors.background, colors.fontMuted) < 3.0) {
    finalMuted = getIdealMutedTextColor(colors.background);
  }

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
  root.style.setProperty('--foreground', hexToHsl(finalForeground));
  root.style.setProperty('--card-foreground', hexToHsl(finalForeground));
  root.style.setProperty('--muted-foreground', hexToHsl(finalMuted));
  root.style.setProperty('--primary', hexToHsl(colors.primary));
  // primary-foreground: texto sobre botão primary
  const onPrimary =
    getContrastRatio(colors.primary, '#FFFFFF') >= 3.0 ? '#FFFFFF' : '#0F172A';
  root.style.setProperty('--primary-foreground', hexToHsl(onPrimary));
  root.style.setProperty('--accent', hexToHsl(colors.accent));
  root.style.setProperty('--border', hexToHsl(colors.border));
  root.style.setProperty('--input', hexToHsl(colors.border));
  root.style.setProperty('--ring', hexToHsl(colors.primary));
  root.style.setProperty('--radius', `${radius}px`);

  root.style.setProperty('--sidebar-background', hexToHsl(colors.bgSecondary));
  root.style.setProperty('--sidebar-foreground', hexToHsl(finalForeground));
  root.style.setProperty('--sidebar-border', hexToHsl(colors.border));
  root.style.setProperty('--sidebar-primary', hexToHsl(colors.primary));
  root.style.setProperty('--sidebar-accent', hexToHsl(colors.accent));

  if (bgOpacity !== undefined) root.style.setProperty('--bg-opacity', bgOpacity.toString());
  if (sidebarOpacity !== undefined)
    root.style.setProperty('--sidebar-opacity', sidebarOpacity.toString());
  if (glassBlur !== undefined) root.style.setProperty('--glass-blur', `${glassBlur}px`);

  window.dispatchEvent(new Event('lexis-theme-changed'));
}

export function applyPresetById(id: string) {
  const preset = AUTHORITY_PRESETS.find((p) => p.id === id) || AUTHORITY_PRESETS[0];
  applyGlobalTheme(preset.colors, preset.radius);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('lexisPredict_theme_preset', preset.id);
  }
  return preset;
}
