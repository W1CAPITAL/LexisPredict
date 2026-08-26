/**
 * Protocolo de amostra de verdade — motor de honorários a receber.
 * Use para rotular 50–100 CNJs e medir precisão/recall (meta nota 7,5).
 *
 * Níveis alinhados a HonorariosReceberNivel:
 * nenhum | fraco | medio | forte | bloqueado
 */

export type RotuloHonorarios = "nenhum" | "fraco" | "medio" | "forte" | "bloqueado";

export type LinhaAmostraVerdade = {
  protocolo: string;
  /** rótulo humano (gold) */
  rotulo_humano: RotuloHonorarios;
  /** saída do motor no momento do teste */
  rotulo_motor?: RotuloHonorarios | null;
  confianca_motor?: number | null;
  observacao?: string;
};

export function matrizConfusao(
  linhas: LinhaAmostraVerdade[]
): {
  total: number;
  acertos: number;
  precisaoForte: number;
  recallForte: number;
  porNivel: Record<string, { gold: number; pred: number; hit: number }>;
} {
  const niveis = ["nenhum", "fraco", "medio", "forte", "bloqueado"] as const;
  const porNivel: Record<string, { gold: number; pred: number; hit: number }> = {};
  for (const n of niveis) porNivel[n] = { gold: 0, pred: 0, hit: 0 };

  let acertos = 0;
  let tpForte = 0;
  let fpForte = 0;
  let fnForte = 0;

  for (const l of linhas) {
    const g = l.rotulo_humano;
    const p = l.rotulo_motor || "nenhum";
    porNivel[g].gold += 1;
    porNivel[p].pred += 1;
    if (g === p) {
      acertos += 1;
      porNivel[g].hit += 1;
    }
    if (p === "forte" && g === "forte") tpForte += 1;
    if (p === "forte" && g !== "forte") fpForte += 1;
    if (p !== "forte" && g === "forte") fnForte += 1;
  }

  const precisaoForte = tpForte + fpForte > 0 ? tpForte / (tpForte + fpForte) : 0;
  const recallForte = tpForte + fnForte > 0 ? tpForte / (tpForte + fnForte) : 0;

  return {
    total: linhas.length,
    acertos,
    precisaoForte: Math.round(precisaoForte * 1000) / 10,
    recallForte: Math.round(recallForte * 1000) / 10,
    porNivel,
  };
}

/** Cabeçalho CSV para planilha de rotulagem */
export const CSV_HEADER_AMOSTRA =
  "protocolo,rotulo_humano,rotulo_motor,confianca_motor,observacao";
