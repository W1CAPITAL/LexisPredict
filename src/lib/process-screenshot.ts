/**
 * Captura de tela real – versão mais estável para Vercel
 * Trata o erro de libnss3.so e bibliotecas faltantes
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
    // Configuração mais estável para Vercel
    chromium.setGraphicsMode = false;

    const executablePath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',          // ajuda em serverless
        '--no-zygote',
        '--disable-web-security',
      ],
      defaultViewport: {
        width: 1280,
        height: 800,
      },
      executablePath,
      headless: true,
      acceptInsecureCerts: true,
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Timeout maior e espera mais tolerante
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Pequena espera para o conteúdo carregar
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const buffer = await page.screenshot({
      fullPage: options?.fullPage ?? true,
      type: 'png',
    });

    await browser.close();
    browser = null;

    // Salva no Supabase
    const supabase = await createClient();
    const path = `evidencias/${cnj.replace(/\D/g, '')}/${Date.now()}.png`;

    const { error } = await supabase.storage
      .from('evidencias')
      .upload(path, buffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (error) {
      return { success: false, error: `Erro ao salvar no Storage: ${error.message}` };
    }

    return { success: true, path };
  } catch (err: any) {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }

    console.error('[Screenshot Error]', err);

    // Mensagem mais amigável
    let message = err.message || 'Falha na captura de tela';

    if (message.includes('libnss3') || message.includes('shared libraries')) {
      message = 'Erro de biblioteca do Chromium na Vercel (libnss3). Tente novamente ou use outro método.';
    }

    return { success: false, error: message };
  }
}
