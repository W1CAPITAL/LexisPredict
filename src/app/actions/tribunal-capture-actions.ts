"use server";

/**
 * Captura automática de tela do tribunal (qualquer UF) a partir do CNJ.
 * Usa Chromium serverless + URL pública do tribunal.
 * Sites com CAPTCHA / bloqueio a headless retornam erro amigável → operador usa embed.
 */

import { getTribunalByCnj, getFallbacksForCnj } from "@/lib/tribunais-links";

export type TribunalCaptureResult = {
  success: boolean;
  /** PNG em data URL (para OCR imediato no cliente) */
  imageBase64?: string;
  path?: string;
  urlUsed?: string;
  tribunal?: string;
  sistema?: string;
  error?: string;
  /** true se o site provavelmente exige CAPTCHA humano */
  needsHuman?: boolean;
};

function digits(cnj: string) {
  return String(cnj || "").replace(/\D/g, "");
}

/**
 * Tenta abrir a consulta pública e tirar screenshot full-page.
 */
export async function captureTribunalAutoAction(
  cnj: string,
  preferredUrl?: string
): Promise<TribunalCaptureResult> {
  const dig = digits(cnj);
  if (dig.length !== 20) {
    return { success: false, error: "CNJ inválido (20 dígitos)." };
  }

  const info = getTribunalByCnj(cnj);
  const fallbacks = typeof getFallbacksForCnj === "function" ? getFallbacksForCnj(cnj) : [];
  const candidates: string[] = [];
  if (preferredUrl?.startsWith("http")) candidates.push(preferredUrl);
  if (info?.url) candidates.push(info.url);
  for (const f of fallbacks || []) {
    const u = typeof f === "string" ? f : (f as any)?.url;
    if (u && !candidates.includes(u)) candidates.push(u);
  }
  if (info && (info as any).alternativos) {
    for (const a of (info as any).alternativos) {
      if (a?.url && !candidates.includes(a.url)) candidates.push(a.url);
    }
  }

  if (!candidates.length) {
    return {
      success: false,
      error: "Tribunal não mapeado para este CNJ. Use o embed manual.",
      needsHuman: true,
    };
  }

  let lastError = "";
  for (const targetUrl of candidates.slice(0, 3)) {
    try {
      const shot = await captureUrlScreenshot(targetUrl, dig);
      if (shot.success && shot.imageBase64) {
        return {
          success: true,
          imageBase64: shot.imageBase64,
          path: shot.path,
          urlUsed: targetUrl,
          tribunal: info?.sigla,
          sistema: info?.sistema,
        };
      }
      lastError = shot.error || "Falha na captura";
      if (shot.needsHuman) {
        return {
          success: false,
          error: lastError,
          urlUsed: targetUrl,
          tribunal: info?.sigla,
          needsHuman: true,
        };
      }
    } catch (e: any) {
      lastError = e?.message || "Erro na captura";
    }
  }

  return {
    success: false,
    error:
      lastError ||
      "Não foi possível capturar automaticamente (CAPTCHA ou bloqueio do tribunal). Use o embed no app e envie o print.",
    tribunal: info?.sigla,
    needsHuman: true,
  };
}

async function captureUrlScreenshot(
  targetUrl: string,
  cnjDigits: string
): Promise<{
  success: boolean;
  imageBase64?: string;
  path?: string;
  error?: string;
  needsHuman?: boolean;
}> {
  let browser: any = null;
  try {
    const puppeteer = await import("puppeteer-core");
    const chromiumMod = await import("@sparticuz/chromium");
    const chromium = (chromiumMod as any).default || chromiumMod;

    if (typeof chromium.setGraphicsMode === "function") {
      chromium.setGraphicsMode = false;
    }

    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: [
        ...(chromium.args || []),
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--no-zygote",
        "--disable-web-security",
        "--window-size=1400,900",
      ],
      defaultViewport: { width: 1400, height: 900 },
      executablePath,
      headless: true,
      acceptInsecureCerts: true, // HTTPS de tribunais
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "pt-BR,pt;q=0.9" });

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 55000,
    });
    await new Promise((r) => setTimeout(r, 2500));

    // Detecta CAPTCHA comum
    const bodyText = await page.evaluate(() => (document.body?.innerText || "").slice(0, 4000));
    const lower = bodyText.toLowerCase();
    if (
      lower.includes("captcha") ||
      lower.includes("não sou um robô") ||
      lower.includes("recaptcha") ||
      lower.includes("hcaptcha")
    ) {
      await browser.close();
      return {
        success: false,
        needsHuman: true,
        error: "O tribunal exige CAPTCHA. Abra no embed, resolva e use «Enviar print».",
      };
    }

    const buffer = await page.screenshot({
      fullPage: true,
      type: "png",
    });
    await browser.close();
    browser = null;

    const imageBase64 = `data:image/png;base64,${Buffer.from(buffer).toString("base64")}`;

    // Best-effort storage
    let path: string | undefined;
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      path = `evidencias/${cnjDigits}/${Date.now()}.png`;
      await supabase.storage.from("evidencias").upload(path, buffer, {
        contentType: "image/png",
        upsert: false,
      });
    } catch {
      path = undefined;
    }

    return { success: true, imageBase64, path };
  } catch (err: any) {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* */
      }
    }
    let message = err?.message || "Falha na captura de tela";
    if (message.includes("libnss3") || message.includes("shared libraries")) {
      message =
        "Chromium indisponível neste ambiente. Use o embed + envio de print.";
    }
    return { success: false, error: message, needsHuman: true };
  }
}
