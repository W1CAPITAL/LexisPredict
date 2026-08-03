/**
 * Substitua generateDjenPublicationPDFAction em document-actions.ts por:
 */
"use server";

import React from "react";
import { readFile } from "fs/promises";
import path from "path";

async function loadLogoBase64(): Promise<string | null> {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const buf = await readFile(logoPath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    try {
      const url = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
      if (!url) return null;
      const base = url.startsWith("http") ? url : `https://${url}`;
      const res = await fetch(`${base}/logo.png`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return `data:image/png;base64,${Buffer.from(ab).toString("base64")}`;
    } catch {
      return null;
    }
  }
}

export async function generateDjenPublicationPDFAction(data: any) {
  try {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { DjenPublicationPDF } = await import("@/components/pdf/djen-publication-pdf");
    const logoBase64 = await loadLogoBase64();
    const element = React.createElement(DjenPublicationPDF as any, {
      data: { ...data, logoBase64 },
    }) as any;
    const pdfBuffer = await renderToBuffer(element);
    return { success: true, base64: Buffer.from(pdfBuffer).toString("base64") };
  } catch (e: any) {
    console.error("[Selagem] Falha no PDF DJEN:", e.message || e);
    return { error: "Falha técnica ao selar a publicação do Diário." };
  }
}
