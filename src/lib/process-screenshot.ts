/**
 * Captura de tela real (full-page) de processo judicial
 * Usa Playwright (já presente no projeto)
 */

import { chromium } from 'playwright';
import { createClient } from '@/lib/supabase/server';

export async function captureProcessScreenshot(
  cnj: string,
  targetUrl: string,
  options?: { fullPage?: boolean }
): Promise<{ success: boolean; path?: string; error?: string }> {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    await page.goto(targetUrl, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // Espera um pouco para conteúdo dinâmico
    await page.waitForTimeout(2000);

    const buffer = await page.screenshot({
      fullPage: options?.fullPage ?? true,
      type: 'png',
    });

    await browser.close();

    const supabase = await createClient();
    const path = `evidencias/${cnj.replace(/\D/g, '')}/${Date.now()}.png`;

    const { error } = await supabase.storage
      .from('evidencias') // crie o bucket "evidencias" no Supabase se ainda não existir
      .upload(path, buffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, path };
  } catch (err: any) {
    if (browser) await browser.close().catch(() => {});
    return { success: false, error: err.message || 'Falha na captura' };
  }
}
