import type { LegalCase } from "@/lib/case-logic";
import { detectFlagsFase } from "@/lib/processos-parados";

export type FaseResumo = {
  fase: string;
  falta: string[];
};

/** Uma linha honesta: fase atual + o que ainda falta. Sem “ALERTA BA” genérico. */
export function resumirFase(c: LegalCase): FaseResumo {
  const f = detectFlagsFase(c);
  const falta: string[] = [];
  let fase = "Em andamento";

  if (f.cumprimentoRecebido) fase = "Cumprimento satisfeito";
  else if (f.cumprimentoAberto) fase = "Cumprimento em aberto";
  else if (f.temSentenca) fase = "Há sentença";
  else if (f.replicaPendente) fase = "Réplica pendente";
  else if (f.temContestacao) fase = "Há contestação";
  else if (f.temCitacao) fase = "Citação";
  else if (f.temAudiencia) fase = "Audiência no histórico";

  if (!f.temContestacao && !f.temSentenca) falta.push("contestação");
  if (f.temContestacao && !f.temReplica && !f.temSentenca) falta.push("réplica");
  if (f.temSentenca && !f.cumprimentoRecebido && !f.cumprimentoAberto) falta.push("andamento pós-sentença");
  if (f.cumprimentoAberto) falta.push("satisfação do cumprimento");

  const txt = `${c.evento_resumo || ""} ${c.datajud_ultimo_nome || ""}`.toUpperCase();
  const soSilencio = !f.temSentenca && !f.temContestacao && !f.temReplica && !f.cumprimentoAberto;
  if (soSilencio) {
    fase = "Silêncio / sem marco de fase";
    if (!falta.length) falta.push("auditoria do último movimento");
  }
  if (/BUSCA E APREEN/.test(txt) && !/MANDADO|LIMINAR|APREENSAO DEFER/.test(txt)) {
    /* jurisprudência citada não vira fase */
  }

  return { fase, falta: falta.slice(0, 3) };
}

export function linhaFase(c: LegalCase): string {
  const r = resumirFase(c);
  return r.falta.length ? `${r.fase} · falta ${r.falta.join(", ")}` : r.fase;
}

export function linhaDonoAto(c: LegalCase): string {
  const dono = String((c as any).atendido_por || c.advogado || "—").trim();
  const quando = String(c.ultimoRetorno || (c as any).ultimo_retorno || "").slice(0, 10) || "sem retorno";
  const passo = String(c.evento_resumo || c.datajud_ultimo_nome || "").slice(0, 80) || "sem último ato";
  return `${dono} · ${quando} · ${passo}`;
}
