/**
 * Captura de tela real – versão estável para Vercel
 * Usa puppeteer-core + @sparticuz/chromium
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { createClient } from '@/lib/supabase/server';

export async function captureProcessScreenshot(
  cnj: string,
  targetUrl: string,
  options?: { fullPage?: boolean }
): Promise<{ success: boolean; path?: string; error?: string }> {
  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 45000,
    });

    await page.waitForTimeout(1500);

    const buffer = await page.screenshot({
      fullPage: options?.fullPage ?? true,
      type: 'png',
    });

    await browser.close();
    browser = null;

    const supabase = await createClient();
    const path = `evidencias/${cnj.replace(/\D/g, '')}/${Date.now()}.png`;

    const { error } = await supabase.storage
      .from('evidencias')
      .upload(path, buffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, path };
  } catch (err: any) {
    if (browser) {
      try { await browser.close(); } catch {}
    }
    return { success: false, error: err.message || 'Falha na captura de tela' };
  }
}
