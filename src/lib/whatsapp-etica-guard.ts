/**
 * Guard antes de copiar/enviar WhatsApp — usa auditor de frases proibidas.
 */

import { auditarTextoEtica } from "@/lib/etica-frases-proibidas";

export type GuardResult =
  | { ok: true; texto: string }
  | { ok: false; motivo: string; trechos: string[] };

export function guardarTextoWhatsAppEtico(texto: string): GuardResult {
  const audit = auditarTextoEtica(texto);
  if (!audit.ok) {
    return {
      ok: false,
      motivo: audit.bloqueios[0]?.motivo || "Linguagem não conforme ao compliance ético",
      trechos: audit.bloqueios.map((b) => b.trecho || b.motivo).filter(Boolean) as string[],
    };
  }
  return { ok: true, texto };
}

/** Copia para clipboard só se compliance OK. */
export async function copiarWhatsAppSeEtico(
  texto: string,
  onBlock?: (motivo: string) => void
): Promise<boolean> {
  const g = guardarTextoWhatsAppEtico(texto);
  if (!g.ok) {
    onBlock?.(g.motivo);
    return false;
  }
  try {
    await navigator.clipboard.writeText(g.texto);
    return true;
  } catch {
    onBlock?.("Falha ao copiar para a área de transferência");
    return false;
  }
}
