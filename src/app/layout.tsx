import type { Metadata, Viewport } from 'next';
import './globals.css';
import '@/styles/lexis-responsive.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/components/auth/auth-provider';
import { ViewerModeBanner } from '@/components/layout/viewer-mode-banner';
import { SessionGuard } from '@/components/auth/session-guard';
import { PlanLockGate } from '@/components/planos/plan-lock-gate';
import Script from 'next/script';
import { MotionRoot } from "@/components/providers/motion-root";
import { LexisErrorBoundary } from "@/components/system/error-boundary";
import { MetalPrefsApplier } from "@/components/ui/metal-prefs-applier";
import { ClientChrome } from "@/components/system/client-chrome";
import { ThemeBoot } from "@/components/system/theme-boot";
import { UiPrefsApplier } from "@/components/system/ui-prefs-applier";
import { AUTHORITY_PRESETS, hexToHsl } from '@/lib/theme';


const PRESET_BOOT_SNAPSHOT = AUTHORITY_PRESETS.map((p) => ({
  id: p.id,
  radius: p.radius,
  light: p.colors.light,
  dark: p.colors.dark,
}));

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#ffffff' }, { media: '(prefers-color-scheme: dark)', color: '#0f0f12' }],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'LexisPredict Elite SaaS',
  description: 'Gabinete Inteligente de Gestão Jurídica e Operações Forenses',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LexisPredict',
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="ops-ui admin-ui font-sans antialiased bg-background text-foreground transition-colors duration-300 min-h-screen">
        <Script id="theme-loader" strategy="beforeInteractive">
          {`
            (function() {
              try {
                var PRESETS = ${JSON.stringify(PRESET_BOOT_SNAPSHOT)};
                var root = document.documentElement;

                var hexToHsl = ${hexToHsl.toString()};
                var lum = function(hex) {
                  if (!hex || hex[0] !== '#') return 0;
                  var c = hex.replace(/^#/, '');
                  var rgb = c.length === 3 ? [c[0]+c[0], c[1]+c[1], c[2]+c[2]] : [c.slice(0,2), c.slice(2,4), c.slice(4,6)];
                  var v = rgb.map(function(x) { var n = parseInt(x, 16) / 255; return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4); });
                  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
                };
                var contrast = function(a, b) {
                  var l1 = lum(a), l2 = lum(b);
                  var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
                  return (hi + 0.05) / (lo + 0.05);
                };
                var setToken = function(name, hex) {
                  if (!hex) return;
                  root.style.setProperty(name, hexToHsl(hex));
                };

                // Modo: light | dark | system
                var mode = localStorage.getItem('lexis_theme_mode');
                var isDark;
                if (mode === 'light') isDark = false;
                else if (mode === 'dark') isDark = true;
                else if (mode === 'system') isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                else isDark = localStorage.getItem('lexis_dark_mode') === 'true';
                root.classList.toggle('dark', isDark);
                root.classList.toggle('light', !isDark);
                localStorage.setItem('lexis_dark_mode', String(isDark));

                // Aplica o preset salvo com a paleta do modo atual (evita flash e contraste quebrado)
                var presetId = localStorage.getItem('lexisPredict_theme_preset');
                var preset = null;
                for (var i = 0; i < PRESETS.length; i++) { if (PRESETS[i].id === presetId) { preset = PRESETS[i]; break; } }

                if (!preset && presetId === 'custom-hardware') {
                  // Tema custom do Hardware Visual — aplicado nos dois modos
                  try {
                    var custom = JSON.parse(localStorage.getItem('lexisPredict_custom_theme') || 'null');
                    if (custom && custom.colors) {
                      var CC = custom.colors;
                      var fgC = contrast(CC.background, CC.foreground) >= 4.5 ? CC.foreground : (lum(CC.background) > 0.45 ? '#000000' : '#FFFFFF');
                      var mutedC = contrast(CC.background, CC.fontMuted) >= 3 ? CC.fontMuted : (lum(CC.background) > 0.45 ? '#4B5563' : '#9CA3AF');
                      var onPrimaryC = contrast(CC.primary, '#FFFFFF') >= 3 ? '#FFFFFF' : '#0F172A';
                      setToken('--background', CC.background);
                      setToken('--card', CC.bgSecondary);
                      setToken('--popover', CC.bgSecondary);
                      setToken('--secondary', CC.bgSecondary);
                      setToken('--foreground', fgC);
                      setToken('--card-foreground', fgC);
                      setToken('--popover-foreground', fgC);
                      setToken('--secondary-foreground', fgC);
                      setToken('--muted-foreground', mutedC);
                      setToken('--primary', CC.primary);
                      setToken('--primary-foreground', onPrimaryC);
                      setToken('--accent', CC.accent);
                      setToken('--accent-foreground', fgC);
                      setToken('--border', CC.border);
                      setToken('--input', CC.border);
                      setToken('--ring', CC.primary);
                      setToken('--destructive', isDark ? '#F87171' : '#DC2626');
                      setToken('--success', isDark ? '#34D399' : '#059669');
                      setToken('--warning', isDark ? '#FBBF24' : '#D97706');
                      setToken('--sidebar-background', CC.bgSecondary);
                      setToken('--sidebar-foreground', fgC);
                      setToken('--sidebar-border', CC.border);
                      setToken('--sidebar-primary', CC.primary);
                      setToken('--sidebar-primary-foreground', onPrimaryC);
                      setToken('--sidebar-accent', CC.accent);
                      setToken('--sidebar-accent-foreground', fgC);
                      setToken('--sidebar-ring', CC.primary);
                      if (custom.radius) root.style.setProperty('--radius', custom.radius + 'px');
                      root.setAttribute('data-lexis-preset', 'custom-hardware');
                    }
                  } catch (e) {}
                }

                if (preset) {
                  var C = isDark ? preset.dark : preset.light;
                  var fg = contrast(C.background, C.foreground) >= 4.5 ? C.foreground : (lum(C.background) > 0.45 ? '#000000' : '#FFFFFF');
                  var muted = contrast(C.background, C.fontMuted) >= 3 ? C.fontMuted : (lum(C.background) > 0.45 ? '#4B5563' : '#9CA3AF');
                  var onPrimary = contrast(C.primary, '#FFFFFF') >= 3 ? '#FFFFFF' : '#0F172A';
                  setToken('--background', C.background);
                  setToken('--card', C.bgSecondary);
                  setToken('--popover', C.bgSecondary);
                  setToken('--secondary', C.bgSecondary);
                  setToken('--foreground', fg);
                  setToken('--card-foreground', fg);
                  setToken('--popover-foreground', fg);
                  setToken('--secondary-foreground', fg);
                  setToken('--muted-foreground', muted);
                  setToken('--primary', C.primary);
                  setToken('--primary-foreground', onPrimary);
                  setToken('--accent', C.accent);
                  setToken('--accent-foreground', fg);
                  setToken('--border', C.border);
                  setToken('--input', C.border);
                  setToken('--ring', C.primary);
                  setToken('--destructive', isDark ? '#F87171' : '#DC2626');
                  setToken('--success', isDark ? '#34D399' : '#059669');
                  setToken('--warning', isDark ? '#FBBF24' : '#D97706');
                  setToken('--sidebar-background', C.bgSecondary);
                  setToken('--sidebar-foreground', fg);
                  setToken('--sidebar-border', C.border);
                  setToken('--sidebar-primary', C.primary);
                  setToken('--sidebar-primary-foreground', onPrimary);
                  setToken('--sidebar-accent', C.accent);
                  setToken('--sidebar-accent-foreground', fg);
                  setToken('--sidebar-ring', C.primary);
                  root.style.setProperty('--radius', preset.radius + 'px');
                  root.setAttribute('data-lexis-preset', preset.id);
                } else if (!isDark) {
                  // Compat legado: cores manuais antigas só quando não escuro
                  var bg = localStorage.getItem('lexisPredict_bg_color');
                  var btn = localStorage.getItem('lexisPredict_btn_bg_color');
                  var font = localStorage.getItem('lexisPredict_font_color');
                  if (bg) setToken('--background', bg);
                  if (btn) setToken('--primary', btn);
                  if (font) setToken('--foreground', font);
                }

                var wallpaper = localStorage.getItem('lexisPredict_wallpaper');
                if (wallpaper) {
                  var wp = wallpaper;
                  if (wp.indexOf('gradient') === -1 && wp.indexOf('url(') !== 0) wp = 'url(' + wp + ')';
                  root.classList.add('lexis-wallpaper-active');
                  root.style.backgroundImage = wp;
                  root.style.backgroundSize = 'cover';
                  root.style.backgroundPosition = 'center';
                  root.style.backgroundAttachment = 'fixed';
                  try { if (document.body) document.body.style.backgroundColor = 'transparent'; } catch (e2) {}
                  try {
                    var o = parseFloat(localStorage.getItem('lexisPredict_bg_opacity') || '0.92');
                    root.style.setProperty('--bg-opacity', String(o));
                  } catch (e3) {}
                } else {
                  root.classList.remove('lexis-wallpaper-active');
                  try { root.style.removeProperty('background-image'); } catch (e4) {}
                }
              } catch (e) {}
            })()
          `}
        </Script>
        <AuthProvider>
          <MetalPrefsApplier />
          <ThemeBoot />
          <UiPrefsApplier />
          <div className="relative z-10 min-h-screen">
            <ClientChrome />
            <LexisErrorBoundary>
              <>
              <ViewerModeBanner />
              <SessionGuard><PlanLockGate><MotionRoot>{children}</MotionRoot></PlanLockGate></SessionGuard>
            </>
            </LexisErrorBoundary>
            </div>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
