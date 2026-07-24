import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/components/auth/auth-provider';
import { GuidedTour } from '@/components/onboarding/guided-tour';
import Script from 'next/script';

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'LexisPredict Elite SaaS',
  description: 'Gabinete Inteligente de Gestão Jurídica e Operações Forenses',
  manifest: '/manifest.json',
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
      <body className="font-sans antialiased bg-background text-foreground transition-colors duration-300 min-h-screen">
        <Script id="theme-loader" strategy="beforeInteractive">
          {`
            (function() {
              try {
                const root = document.documentElement;
                
                // Dark Mode Detection
                const isDark = localStorage.getItem('lexis_dark_mode') === 'true';
                if (isDark) {
                  root.classList.add('dark');
                } else {
                  root.classList.remove('dark');
                }

                // Custom Color Hardware (Only if not dark)
                if (!isDark) {
                  const bg = localStorage.getItem('lexisPredict_bg_color') || '#FFFFFF';
                  const btn = localStorage.getItem('lexisPredict_btn_bg_color') || '#00D1FF';
                  const font = localStorage.getItem('lexisPredict_font_color') || '#000000';
                  
                  const hexToHsl = (hex) => {
                    if (!hex || hex[0] !== '#') return null;
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
                    return Math.round(h * 360) + ' ' + Math.round(s * 100) + '% ' + Math.round(l * 100) + '%';
                  };

                  const hslBg = hexToHsl(bg);
                  const hslBtn = hexToHsl(btn);
                  const hslFont = hexToHsl(font);

                  if(hslBg) root.style.setProperty('--background', hslBg);
                  if(hslBtn) root.style.setProperty('--primary', hslBtn);
                  if(hslFont) root.style.setProperty('--foreground', hslFont);
                }
                
                const wallpaper = localStorage.getItem('lexisPredict_wallpaper');
                if (wallpaper) {
                  root.style.backgroundImage = 'url(' + wallpaper + ')';
                  root.style.backgroundSize = 'cover';
                  root.style.backgroundPosition = 'center';
                  root.style.backgroundAttachment = 'fixed';
                }
              } catch (e) {}
            })()
          `}
        </Script>
        <AuthProvider>
          <div className="relative z-10 min-h-screen">
            <GuidedTour />
            {children}
          </div>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
