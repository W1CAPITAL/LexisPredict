/**
 * Listas operacionais da fila de Tarefas:
 * - blacklist: clientes problemáticos (fora do topo automático)
 * - tratamento: críticos em atendimento (não competem pelo topo)
 * Persistência em marcadores na observação + localStorage por empresa.
 */
export type FilaLista = "blacklist" | "tratamento" | "normal";

const TAG_BLACK = "[LISTA:BLACKLIST]";
const TAG_TRAT = "[LISTA:TRATAMENTO]";

export function parseFilaListaFromObs(obs?: string | null): FilaLista {
  const o = String(obs || "").toUpperCase();
  if (o.includes("[LISTA:BLACKLIST]")) return "blacklist";
  if (o.includes("[LISTA:TRATAMENTO]")) return "tratamento";
  return "normal";
}

export function applyFilaListaToObs(obs: string | undefined, lista: FilaLista): string {
  let o = String(obs || "")
    .replace(/\[LISTA:BLACKLIST\]/gi, "")
    .replace(/\[LISTA:TRATAMENTO\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (lista === "blacklist") o = `${TAG_BLACK} ${o}`.trim();
  if (lista === "tratamento") o = `${TAG_TRAT} ${o}`.trim();
  return o;
}

/** Atendimento recente (horas) → não deve ficar no topo da sequência prioritária. */
export function isAtendimentoRecente(
  ultimoRetorno?: string | null,
  horas = 36
): boolean {
  if (!ultimoRetorno) return false;
  try {
    const raw = String(ultimoRetorno).trim();
    let d: Date;
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) d = new Date(raw);
    else if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
      const [dd, mm, yyyy] = raw.slice(0, 10).split("/").map(Number);
      d = new Date(yyyy, mm - 1, dd);
    } else d = new Date(raw);
    if (Number.isNaN(d.getTime())) return false;
    const diffH = (Date.now() - d.getTime()) / 36e5;
    return diffH >= 0 && diffH <= horas;
  } catch {
    return false;
  }
}

export function groupFilaLista(cases: { observacao?: string }[]): FilaLista {
  const flags = cases.map((c) => parseFilaListaFromObs(c.observacao));
  if (flags.includes("blacklist")) return "blacklist";
  if (flags.includes("tratamento")) return "tratamento";
  return "normal";
}
