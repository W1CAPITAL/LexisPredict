
/**
 * @fileOverview MOTOR DE ENGENHARIA CROMÁTICA v200.0 ELITE
 * Gerenciamento de Variáveis de Hardware e Presets Authority Series.
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
};

export const AUTHORITY_PRESETS: ThemePreset[] = [
  {
    id: 'minimal-steel',
    name: 'Minimal Steel',
    radius: 4,
    colors: {
      background: '#FFFFFF',
      bgSecondary: '#F8FAFC',
      foreground: '#0F172A',
      fontMuted: '#64748B',
      primary: '#00D1FF',
      accent: '#F1F5F9',
      border: '#E2E8F0'
    }
  },
  {
    id: 'white-prestige',
    name: 'White Prestige',
    radius: 8,
    colors: {
      background: '#F3F2F2',
      bgSecondary: '#FFFFFF',
      foreground: '#000000',
      fontMuted: '#4B5563',
      primary: '#000000',
      accent: '#E5E7EB',
      border: '#000000'
    }
  }
];

export function hexToHsl(hex: string): string {
  if (!hex || hex[0] !== '#') return '0 0% 0%';
  const cleanHex = hex.replace(/^#/, '');
  let r = parseInt(cleanHex.length === 3 ? cleanHex[0]+cleanHex[0] : cleanHex.slice(0, 2), 16) / 255;
  let g = parseInt(cleanHex.length === 3 ? cleanHex[1]+cleanHex[1] : cleanHex.slice(2, 4), 16) / 255;
  let b = parseInt(cleanHex.length === 3 ? cleanHex[2]+cleanHex[2] : cleanHex.slice(4, 6), 16) / 255;
  
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyGlobalTheme(colors: ThemeColors, radius: number, bgOpacity?: number, sidebarOpacity?: number, glassBlur?: number) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  
  // Protocolo de Verificação de Contraste (WCAG Compliance)
  let finalForeground = colors.foreground;
  if (getContrastRatio(colors.background, colors.foreground) < 3.0) {
     finalForeground = getIdealTextColor(colors.background);
  }
  
  let finalMuted = colors.fontMuted;
  if (getContrastRatio(colors.background, colors.fontMuted) < 2.5) {
     finalMuted = getIdealMutedTextColor(colors.background);
  }

  // Persistência local do Hardware
  localStorage.setItem('lexisPredict_bg_color', colors.background);
  localStorage.setItem('lexisPredict_bg_secondary_color', colors.bgSecondary);
  localStorage.setItem('lexisPredict_font_color', finalForeground);
  localStorage.setItem('lexisPredict_font_muted_color', finalMuted);
  localStorage.setItem('lexisPredict_btn_bg_color', colors.primary);
  localStorage.setItem('lexisPredict_btn_inactive_color', colors.accent);
  localStorage.setItem('lexisPredict_border_color', colors.border);
  localStorage.setItem('lexisPredict_border_radius', radius.toString());

  if (bgOpacity !== undefined) localStorage.setItem('lexisPredict_bg_opacity', bgOpacity.toString());
  if (sidebarOpacity !== undefined) localStorage.setItem('lexisPredict_sidebar_opacity', sidebarOpacity.toString());
  if (glassBlur !== undefined) localStorage.setItem('lexisPredict_glass_blur', glassBlur.toString());

  // Injeção de variáveis CSS no Root
  root.style.setProperty('--background', hexToHsl(colors.background));
  root.style.setProperty('--card', hexToHsl(colors.background));
  root.style.setProperty('--popover', hexToHsl(colors.background));
  root.style.setProperty('--secondary', hexToHsl(colors.bgSecondary));
  root.style.setProperty('--foreground', hexToHsl(finalForeground));
  root.style.setProperty('--muted-foreground', hexToHsl(finalMuted));
  root.style.setProperty('--primary', hexToHsl(colors.primary));
  root.style.setProperty('--accent', hexToHsl(colors.accent));
  root.style.setProperty('--border', hexToHsl(colors.border));
  root.style.setProperty('--radius', `${radius}px`);
  
  // Hardware de Sidebar
  root.style.setProperty('--sidebar-background', hexToHsl(colors.background));
  root.style.setProperty('--sidebar-foreground', hexToHsl(finalForeground));
  root.style.setProperty('--sidebar-border', hexToHsl(colors.border));
  root.style.setProperty('--sidebar-primary', hexToHsl(colors.primary));

  if (bgOpacity !== undefined) root.style.setProperty('--bg-opacity', bgOpacity.toString());
  if (sidebarOpacity !== undefined) root.style.setProperty('--sidebar-opacity', sidebarOpacity.toString());
  if (glassBlur !== undefined) root.style.setProperty('--glass-blur', `${glassBlur}px`);
  
  window.dispatchEvent(new Event("lexis-theme-changed"));
}
