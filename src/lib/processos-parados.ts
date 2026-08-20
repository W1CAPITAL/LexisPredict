/**
 * Processos parados no tribunal — sem movimentação útil há N dias,
 * ainda ativos na carteira, com oportunidade de reativação / cobrança de andamento.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import type { LegalCase } from "./case-logic";
import { isCasoEncerrado } from "./status-encerrado";

export type FaixaParado = 30 | 60 | 90 | 120 | 180;

export interface ProcessoParadoItem {
  case: LegalCase;
  /** Dias desde o último sinal do tribunal (movimento/DJEN) */
  diasParadoTribunal: number;
  /** Dias desde o último retorno da equipe (se houver) */
  diasSemRetornoEquipe: number | null;
  /** Fonte da data usada no cálculo */
  fonteData: "datajud" | "djen" | "scan" | "retorno" | "desconhecida";
  dataReferencia: string | null;
  ultimoSinalResumo: string;
  /** Por que ainda dá para agir */
  oportunidades: string[];
  scoreAcao: number;
}

function parseDateLoose(raw?: string | null): Date | null {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  try {
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
      const [dd, mm, yyyy] = s.slice(0, 10).split("/").map(Number);
      const d = new Date(yyyy, mm - 1, dd);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s.includes("T") ? s : s.slice(0, 10));
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function diasDesde(d: Date | null, now = new Date()): number | null {
  if (!d) return null;
  const ms = now.getTime() - d.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / 86400000);
}

/** Última data de movimento do tribunal (DataJud ∪ DJEN ∪ scan). */
export function ultimaDataTribunal(c: LegalCase): {
  date: Date | null;
  fonte: ProcessoParadoItem["fonteData"];
  raw: string | null;
  resumo: string;
} {
  const candidates: { raw: string | null | undefined; fonte: ProcessoParadoItem["fonteData"]; resumo: string }[] = [
    {
      raw: c.datajud_ultimo_movimento || (c as any).datajud_ultimo_movimento,
      fonte: "datajud",
      resumo: String(c.datajud_ultimo_nome || c.evento_resumo || "Movimento DataJud"),
    },
    {
      raw: (c as any).djen_ultimo_data || (c as any).djen_data_disponibilizacao || null,
      fonte: "djen",
      resumo: String((c as any).djen_ultimo_resumo || "Publicação DJEN").slice(0, 160),
    },
    {
      raw: c.datajud_consultado_em || (c as any).djen_consultado_em,
      fonte: "scan",
      resumo: "Última consulta ao tribunal (sem movimento novo capturado)",
    },
  ];

  let best: { date: Date; fonte: ProcessoParadoItem["fonteData"]; raw: string; resumo: string } | null = null;
  for (const cand of candidates) {
    const d = parseDateLoose(cand.raw);
    if (!d) continue;
    if (!best || d.getTime() > best.date.getTime()) {
      best = { date: d, fonte: cand.fonte, raw: String(cand.raw), resumo: cand.resumo };
    }
  }

  if (best) {
    return { date: best.date, fonte: best.fonte, raw: best.raw, resumo: best.resumo };
  }

  // Sem dado de tribunal: usa retorno só como fallback fraco
  const ret = parseDateLoose(c.ultimoRetorno || (c as any).ultimo_retorno);
  if (ret) {
    return {
      date: ret,
      fonte: "retorno",
      raw: String(c.ultimoRetorno || (c as any).ultimo_retorno),
      resumo: "Sem movimento tribunal no cadastro — referência = último retorno da equipe",
    };
  }

  return { date: null, fonte: "desconhecida", raw: null, resumo: "Sem data de movimento conhecida" };
}

function oportunidadesDe(c: LegalCase, diasParado: number): string[] {
  const ops: string[] = [];
  if (diasParado >= 30) {
    ops.push("Cobrar andamento / petição de impulso processual");
  }
  if (diasParado >= 60) {
    ops.push("Contatar cliente: processo parado — alinhar expectativa e próximos passos");
  }
  if (diasParado >= 90) {
    ops.push("Revisão interna: ainda cabe recurso, cumprimento ou baixa?");
  }
  if (c.em_cumprimento_sentenca || c.evento_tipo === "cumprimento_sentenca") {
    ops.push("Fase executiva: verificar cumprimento / guia / depósito");
  }
  if ((c as any).is_procedente || c.evento_tipo === "sentenca_procedente") {
    ops.push("Procedente: oportunidade de honorários / cumprimento");
  }
  if (c.datajud_encerrado_tribunal && !isCasoEncerrado(c)) {
    ops.push("Tribunal indica baixa — alinhar status na carteira");
  }
  if (!(c.telefone || (c as any).phone)) {
    ops.push("Cadastrar telefone para reativação via WhatsApp");
  }
  if (!ops.length) ops.push("Monitorar e reagendar contato");
  return ops;
}

export function scoreAcaoParado(
  diasParado: number,
  diasSemRetorno: number | null,
  c: LegalCase
): number {
  let s = Math.min(400, diasParado * 2);
  if (diasSemRetorno != null) s += Math.min(200, diasSemRetorno);
  else s += 80; // nunca contatou
  if (c.em_cumprimento_sentenca) s += 60;
  if ((c as any).is_procedente || c.evento_tipo === "sentenca_procedente") s += 50;
  if (c.datajud_encerrado_tribunal) s += 40;
  if (c.telefone) s += 20;
  return Math.round(s);
}

/**
 * Lista processos ativos parados há pelo menos `minDias` sem movimento de tribunal.
 */
export function listProcessosParados(
  cases: LegalCase[],
  minDias: number = 60,
  now = new Date()
): ProcessoParadoItem[] {
  const out: ProcessoParadoItem[] = [];

  for (const c of cases || []) {
    if (isCasoEncerrado(c)) continue;
    if (String(c.situacao || "").toUpperCase() === "ARQUIVADO") continue;

    const ult = ultimaDataTribunal(c);
    const diasParado = diasDesde(ult.date, now);

    // Sem nenhuma data: tratar como "desconhecido — prioritário revisar" com score médio
    const dias = diasParado == null ? 999 : diasParado;
    if (dias < minDias && diasParado != null) continue;

    const retD = parseDateLoose(c.ultimoRetorno || (c as any).ultimo_retorno);
    const diasSemRetorno = diasDesde(retD, now);

    const item: ProcessoParadoItem = {
      case: c,
      diasParadoTribunal: diasParado == null ? 999 : diasParado,
      diasSemRetornoEquipe: diasSemRetorno,
      fonteData: ult.fonte,
      dataReferencia: ult.raw,
      ultimoSinalResumo: ult.resumo,
      oportunidades: oportunidadesDe(c, diasParado == null ? 999 : diasParado),
      scoreAcao: scoreAcaoParado(diasParado == null ? 180 : diasParado, diasSemRetorno, c),
    };
    out.push(item);
  }

  out.sort((a, b) => b.scoreAcao - a.scoreAcao || b.diasParadoTribunal - a.diasParadoTribunal);
  return out;
}

/** Mensagem leiga para cobrar andamento / reativar contato */
export function scriptProcessoParado(c: LegalCase, diasParado: number): string {
  const nome = String(c.cliente || "Cliente").split(/[\/\-]/)[0].trim() || "Cliente";
  const cnj = c.protocolo || "";
  const faixa =
    diasParado >= 180
      ? "vários meses"
      : diasParado >= 90
        ? "cerca de três meses ou mais"
        : diasParado >= 60
          ? "cerca de dois meses"
          : "algumas semanas";

  return [
    `Olá, ${nome}! Tudo bem?`,
    ``,
    `Passando para alinhar o andamento do processo nº ${cnj}.`,
    ``,
    `Pelos registros do tribunal, não houve movimentação nova há ${faixa}. Isso é comum em algumas fases, mas nossa equipe está revisando se cabe alguma providência para impulsionar o processo (pedido de andamento ou outra medida adequada ao caso).`,
    ``,
    `Você não precisa fazer nada neste momento. Assim que concluirmos a análise, te retorno com o próximo passo de forma clara.`,
    ``,
    `Qualquer dúvida, é só responder esta mensagem.`,
  ].join("\n");
}
