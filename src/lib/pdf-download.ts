"use client";

/**
 * Helper de exportação de PDF — renderiza um documento @react-pdf/renderer
 * no navegador e dispara o download real (arquivo .pdf), em vez de window.print().
 * @copyright 2026 W1 Capital / LexisPredict
 */

import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import type { ReactElement } from "react";

export async function downloadPdf(
  el: ReactElement,
  filename: string
): Promise<boolean> {
  try {
    const blob = await pdf(el).toBlob();
    saveAs(blob, filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
    return true;
  } catch (e) {
    console.error("[lexis-pdf] Falha ao gerar PDF:", e);
    return false;
  }
}
