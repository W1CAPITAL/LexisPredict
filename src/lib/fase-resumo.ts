import type { LegalCase } from "@/lib/case-logic";
import { detectFlagsFase } from "@/lib/processos-parados";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Esconde auth_user_id / uuid na UI; mostra nome legível quando houver. */
export function labelPessoa(raw?: string | null, fallback = "Equipe"): string {
  const s = String(raw || "").trim();
  if (!s) return fallback;
  if (UUID_RE.test(s)) return fallback;
  if (/^[0-9a-f]{32}$/i.test(s)) return fallback;
  return s;
}



export type FaseResumo = {
  fase: string;
  falta: string[];
};

/** Uma linha honesta: fase atual + o que ainda falta. Sem “ALERTA BA” genérico. */
export function resumirFase(c?: LegalCase | null): FaseResumo {
  if (!c) return { fase: "Sem processo", falta: [] };
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

export function linhaFase(c?: LegalCase | null): string {
  const r = resumirFase(c);
  return r.falta.length ? `${r.fase} · falta ${r.falta.join(", ")}` : r.fase;
}

export function linhaDonoAto(c?: LegalCase | null): string {
  if (!c) return "—";
  const rawDono = String((c as any).atendido_por_nome || (c as any).atendido_por || c.advogado || "").trim();
  const dono = labelPessoa(rawDono, String(c.advogado || "Equipe").trim() || "Equipe");
  const quando = String(c.ultimoRetorno || (c as any).ultimo_retorno || "").slice(0, 10) || "sem retorno";
  let passo = String(c.evento_resumo || c.datajud_ultimo_nome || "").replace(/\s+/g, " ").trim();
  // não repetir CNJ inteiro no resumo se já está na linha de cima
  passo = passo.slice(0, 72) || "sem último ato";
  return `${dono} · ${quando} · ${passo}`;
}


export function proximoPasso(c?: LegalCase | null): string {
  const r = resumirFase(c);
  if (!c) return "Abrir o processo e conferir o último ato";
  if (r.falta.includes("satisfação do cumprimento")) return "Conferir levantamento / quitação do cumprimento";
  if (r.falta.includes("réplica")) return "Prazo de réplica: protocolar ou pedir prazo";
  if (r.falta.includes("contestação")) return "Checar citação e prazo de defesa";
  if (r.fase.includes("Silêncio")) return "Auditar tribunal e impulsionar se parado";
  if (r.falta.length) return `Tratar: ${r.falta[0]}`;
  const dono = String((c as any).atendido_por || "").trim();
  if (!c.ultimoRetorno && !dono) return "Registrar primeiro atendimento";
  return "Manter acompanhamento na data combinada";
}

export function linhaDonoPasso(c?: LegalCase | null): string {
  return `${linhaDonoAto(c)} · próximo: ${proximoPasso(c)}`;
}


export function diasDesdeTribunal(c?: LegalCase | null): number | null {
  if (!c) return null;
  const raw = String((c as any).datajud_ultimo_movimento || (c as any).djen_ultima_data || c.evento_data || "").slice(0, 10);
  if (!raw) return null;
  const d = new Date(raw.includes("/") ? raw.split("/").reverse().join("-") : raw);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b - a) / 86400000));
}
