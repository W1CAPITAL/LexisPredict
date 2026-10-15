"use client";
/** Download de PDFs gerados pelo servidor; evita URLs data: muito grandes. */
export function downloadGeneratedPdf(base64: string, fileName: string): void {
  if (typeof document === "undefined") throw new Error("Download disponível somente no navegador.");
  const b64 = String(base64 || "").trim().replace(/^data:application\/pdf;base64,/i, "");
  if (!b64) throw new Error("O gerador retornou um PDF vazio.");
  const decoded = atob(b64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  if (bytes.length < 5 || String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-")
    throw new Error("Arquivo recebido não é um PDF válido.");
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = String(fileName || "documento.pdf").replace(/[^\p{L}\p{N}_.\-]+/gu, "_").slice(0, 150);
  if (!link.download.toLowerCase().endsWith(".pdf")) link.download += ".pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
