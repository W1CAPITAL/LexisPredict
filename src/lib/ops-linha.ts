/**
 * Linha operacional única — Dashboard, Carteira, Processos, Fila, Relatório.
 * Score 0–100: o que a assessoria trata hoje, sem alarme de jurisprudência.
 */
import type { LegalCase } from "@/lib/case-logic";
import { isCasoEncerrado } from "@/lib/status-encerrado";
import { isBuscaApreensaoReal } from "@/lib/ba-real";
import { detectFlagsFase } from "@/lib/processos-parados";
import {
  diasDesdeTribunal,
  linhaDonoAto,
  proximoPasso,
  resumirFase,
} from "@/lib/fase-resumo";
import { statusEfetivo } from "@/lib/prazo-status";

export type OpsLinha = {
  score: number;
  fase: string;
  falta: string[];
  proximo: string;
  dono: string;
  diasTribunal: number | null;
  tags: string[];
  baReal: boolean;
};

function statusOf(c: LegalCase): string {
  try {
    return String(statusEfetivo(c) || c.status || "");
  } catch {
    return String(c.status || "");
  }
}

export function computeOpsLinha(c?: LegalCase | null): OpsLinha {
  if (!c) {
    return {
      score: 0,
      fase: "—",
      falta: [],
      proximo: "—",
      dono: "—",
      diasTribunal: null,
      tags: [],
      baReal: false,
    };
  }

  const fase = resumirFase(c);
  const flags = detectFlagsFase(c);
  const diasT = diasDesdeTribunal(c);
  const st = statusOf(c);
  const baReal = isBuscaApreensaoReal(c);
  const tags: string[] = [];
  let score = 18;

  if (baReal) {
    score = 100;
    tags.push("BA real");
  } else if (st === "Caso Crítico" || st === "Vencido") {
    score = 92;
    tags.push("prazo");
  } else if (flags.replicaPendente) {
    score = 86;
    tags.push("réplica");
  } else if (flags.cumprimentoAberto) {
    score = 80;
    tags.push("cumprimento");
  } else if (c.tem_novo_andamento || c.tem_atualizacao_pos_retorno || c.djen_nova_comunicacao) {
    score = 74;
    tags.push("novidade");
  } else if (diasT != null && diasT >= 90) {
    score = 70;
    tags.push("silêncio 90d");
  } else if (diasT != null && diasT >= 60) {
    score = 62;
    tags.push("silêncio 60d");
  } else if (diasT != null && diasT >= 45) {
    score = 54;
    tags.push("silêncio 45d");
  } else if (st === "É Hoje") {
    score = 50;
    tags.push("hoje");
  } else if (st === "Atenção") {
    score = 40;
    tags.push("atenção");
  }

  if (flags.replicaPendente && !tags.includes("réplica")) tags.push("réplica");
  if (flags.cumprimentoAberto && !tags.includes("cumprimento")) tags.push("cumprimento");
  if (diasT != null && diasT >= 45 && !tags.some((t) => t.startsWith("silêncio"))) {
    tags.push(`silêncio ${diasT}d`);
  }

  return {
    score,
    fase: fase.fase,
    falta: fase.falta,
    proximo: proximoPasso(c),
    dono: linhaDonoAto(c),
    diasTribunal: diasT,
    tags: tags.slice(0, 3),
    baReal,
  };
}

export function compareOps(a: LegalCase, b: LegalCase): number {
  return computeOpsLinha(b).score - computeOpsLinha(a).score;
}

export type OpsKpis = {
  ativos: number;
  vencidos: number;
  replicaPendente: number;
  cumprimentoAberto: number;
  silencio45: number;
  silencio60: number;
  novidades: number;
  baReal: number;
  top: LegalCase[];
};

export function computeOpsKpis(cases: LegalCase[] | null | undefined): OpsKpis {
  const ativos = (cases || []).filter((c) => !isCasoEncerrado(c));
  let replicaPendente = 0;
  let cumprimentoAberto = 0;
  let silencio45 = 0;
  let silencio60 = 0;
  let novidades = 0;
  let baReal = 0;
  let vencidos = 0;

  for (const c of ativos) {
    const o = computeOpsLinha(c);
    const st = statusOf(c);
    if (st === "Vencido" || st === "Caso Crítico") vencidos++;
    if (o.tags.includes("réplica") || o.fase === "Réplica pendente") replicaPendente++;
    if (o.tags.includes("cumprimento") || o.fase === "Cumprimento em aberto") cumprimentoAberto++;
    if (o.diasTribunal != null && o.diasTribunal >= 45) silencio45++;
    if (o.diasTribunal != null && o.diasTribunal >= 60) silencio60++;
    if (o.tags.includes("novidade")) novidades++;
    if (o.baReal) baReal++;
  }

  const top = [...ativos].sort(compareOps).slice(0, 12);
  return {
    ativos: ativos.length,
    vencidos,
    replicaPendente,
    cumprimentoAberto,
    silencio45,
    silencio60,
    novidades,
    baReal,
    top,
  };
}
