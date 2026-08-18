"use client";

/**
 * Telemetria por Escritório / Advogado / Dono (operador).
 * - Vencidos = responsabilidade do DONO (created_by), não do advogado.
 * - Score proporcional ao volume (taxas), não contagem bruta.
 * - Improcedentes entram no cálculo (espelho lógico dos procedentes).
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import React, { useMemo, useState } from "react";
import { LegalCase } from "@/lib/case-logic";
import { isCasoEncerrado, isBaixaTribunal } from "@/lib/status-encerrado";
import { isSentencaProcedente, isSentencaImprocedente } from "@/lib/merito-detect";
import { resolveTemNovoAndamento } from "@/lib/novidade";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  TrendingDown,
  TrendingUp,
  Scale,
  Gavel,
  Zap,
  UserCog,
} from "lucide-react";

interface OfficeStatsProps {
  cases: LegalCase[];
  className?: string;
}

type Tab = "escritorio" | "advogado" | "dono";

function dadosOf(c: LegalCase): Record<string, any> {
  const d = (c as any).dados;
  return d && typeof d === "object" ? d : {};
}

function isCumprimentoAtivo(c: LegalCase): boolean {
  if (c.em_cumprimento_sentenca) return true;
  const d = dadosOf(c);
  if (d.em_cumprimento_sentenca) return true;
  const st = String(
    (c as any).status_executivo || d.status_executivo || d.detalhes_execucao?.status_executivo || ""
  );
  return st === "ativo";
}

function isFaltaInstaurar(c: LegalCase): boolean {
  if (c.cumprimento_pendente_necessario) return true;
  return !!dadosOf(c).cumprimento_pendente_necessario;
}

function isOportunidadeHonorarios(c: LegalCase): boolean {
  const d = dadosOf(c);
  const op =
    (c as any).oportunidade_instaurar ||
    d.oportunidade_instaurar ||
    (c as any).detalhes_execucao?.oportunidade_instaurar ||
    d.detalhes_execucao?.oportunidade_instaurar;
  const elegivel =
    !!(c as any).oportunidade_elegivel || !!d.oportunidade_elegivel || !!op?.elegivel;
  const score = Number((c as any).oportunidade_score ?? op?.score ?? 0);
  const tipo = String((c as any).oportunidade_tipo_credito || op?.tipo_credito || "").toLowerCase();
  if (tipo.includes("sucumb")) return elegivel || score >= 40;
  return elegivel && score >= 55;
}

/** Espelho negativo do procedente: improcedente ainda relevante na operação. */
function isImprocedenteRelevante(c: LegalCase): boolean {
  if (!isSentencaImprocedente(c as any)) return false;
  if (isCasoEncerrado(c) && isBaixaTribunal(c)) return false;
  return true;
}

function isBA(c: LegalCase): boolean {
  return !!(c as any).indicio_busca_apreensao || !!dadosOf(c).indicio_busca_apreensao;
}

function isVencidoOperacional(c: LegalCase): boolean {
  if (isCasoEncerrado(c)) return false;
  return c.status === "Vencido" || c.status === "Caso Crítico";
}

function pct(n: number, den: number): number {
  if (!den || den <= 0) return 0;
  return (n / den) * 100;
}

/** Score 0–100 por TAXAS (volume-aware). Carteira pequena é suavizada. */
function scorePorTaxas(opts: {
  total: number;
  ativos: number;
  procedRate: number;
  improcRate: number;
  oportRate: number;
  cumprRate: number;
  instaurarRate: number;
  vencidoRate?: number;
  baRate?: number;
}): number {
  const {
    total,
    procedRate,
    improcRate,
    oportRate,
    cumprRate,
    instaurarRate,
    vencidoRate = 0,
    baRate = 0,
  } = opts;
  if (total <= 0) return 0;

  let s =
    50 +
    procedRate * 0.35 +
    oportRate * 0.25 +
    cumprRate * 0.1 +
    instaurarRate * 0.08 -
    improcRate * 0.35 -
    vencidoRate * 0.4 -
    baRate * 0.2;

  const k = 12;
  const w = total / (total + k);
  s = 50 * (1 - w) + s * w;
  return Math.round(Math.max(0, Math.min(100, s)));
}

type Agg = {
  key: string;
  label: string;
  sub?: string;
  total: number;
  ativos: number;
  vencidos: number;
  procedentes: number;
  improcedentes: number;
  improcedentesRelevantes: number;
  cumprimentoAtivo: number;
  faltaInstaurar: number;
  oportunidade: number;
  baixasTribunal: number;
  ba: number;
  novidades: number;
};

function emptyAgg(key: string, label: string, sub?: string): Agg {
  return {
    key,
    label,
    sub,
    total: 0,
    ativos: 0,
    vencidos: 0,
    procedentes: 0,
    improcedentes: 0,
    improcedentesRelevantes: 0,
    cumprimentoAtivo: 0,
    faltaInstaurar: 0,
    oportunidade: 0,
    baixasTribunal: 0,
    ba: 0,
    novidades: 0,
  };
}

function bump(a: Agg, c: LegalCase, opts: { countVencido: boolean }) {
  a.total++;
  if (!isCasoEncerrado(c)) a.ativos++;
  if (opts.countVencido && isVencidoOperacional(c)) a.vencidos++;
  if (isSentencaProcedente(c as any)) a.procedentes++;
  if (isSentencaImprocedente(c as any)) a.improcedentes++;
  if (isImprocedenteRelevante(c)) a.improcedentesRelevantes++;
  if (isCumprimentoAtivo(c)) a.cumprimentoAtivo++;
  if (isFaltaInstaurar(c)) a.faltaInstaurar++;
  if (isOportunidadeHonorarios(c)) a.oportunidade++;
  if (isBaixaTribunal(c)) a.baixasTribunal++;
  if (isBA(c)) a.ba++;
  if (resolveTemNovoAndamento(c as any)) a.novidades++;
}

type Scored = Agg & {
  procedRate: number;
  improcRate: number;
  oportRate: number;
  vencidoRate: number;
  score: number;
};

function withScores(rows: Agg[], mode: "advogado" | "operacao"): Scored[] {
  return rows
    .map((r) => {
      const den = r.total || 1;
      const procedRate = pct(r.procedentes, den);
      const improcRate = pct(r.improcedentesRelevantes || r.improcedentes, den);
      const oportRate = pct(r.oportunidade, den);
      const cumprRate = pct(r.cumprimentoAtivo, den);
      const instaurarRate = pct(r.faltaInstaurar, den);
      const vencidoRate = mode === "operacao" ? pct(r.vencidos, r.ativos || den) : 0;
      const baRate = mode === "operacao" ? pct(r.ba, den) : 0;
      const score = scorePorTaxas({
        total: r.total,
        ativos: r.ativos,
        procedRate,
        improcRate,
        oportRate,
        cumprRate,
        instaurarRate,
        vencidoRate,
        baRate,
      });
      return { ...r, procedRate, improcRate, oportRate, vencidoRate, score };
    })
    .sort((a, b) => b.score - a.score || b.total - a.total);
}

function shortId(id: string) {
  if (!id || id === "sem-dono") return "Sem dono";
  if (id.length <= 12) return id;
  return id.slice(0, 8) + "…";
}

export function OfficeStats({ cases, className }: OfficeStatsProps) {
  const [tab, setTab] = useState<Tab>("escritorio");

  const { offices, lawyers, owners } = useMemo(() => {
    const uniqueMap = new Map<string, LegalCase>();
    cases.forEach((c) => {
      if (c?.protocolo) uniqueMap.set(c.protocolo, c);
    });

    const byOffice: Record<string, Agg> = {};
    const byAdv: Record<string, Agg> = {};
    const byOwner: Record<string, Agg> = {};

    uniqueMap.forEach((c) => {
      const office = (c.escritorio || "Sem Escritório").trim().toUpperCase() || "SEM ESCRITÓRIO";
      const adv = (c.advogado || "Sem advogado").trim().toUpperCase() || "SEM ADVOGADO";
      const ownerRaw = String((c as any).created_by || "").trim() || "sem-dono";

      if (!byOffice[office]) byOffice[office] = emptyAgg(office, office);
      if (!byAdv[`${adv}||${office}`])
        byAdv[`${adv}||${office}`] = emptyAgg(`${adv}||${office}`, adv, office);
      if (!byOwner[ownerRaw])
        byOwner[ownerRaw] = emptyAgg(
          ownerRaw,
          ownerRaw === "sem-dono" ? "Sem dono" : shortId(ownerRaw)
        );

      bump(byOffice[office], c, { countVencido: true });
      bump(byAdv[`${adv}||${office}`], c, { countVencido: false });
      bump(byOwner[ownerRaw], c, { countVencido: true });
    });

    return {
      offices: withScores(Object.values(byOffice), "operacao"),
      lawyers: withScores(Object.values(byAdv), "advogado").slice(0, 30),
      owners: withScores(Object.values(byOwner), "operacao").slice(0, 30),
    };
  }, [cases]);

  if (cases.length === 0) return null;

  return (
    <section className={cn("premium-card overflow-hidden", className)}>
      <div className="px-6 md:px-8 py-5 border-b border-border/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-black tracking-tight">Telemetria de Performance</h3>
            <p className="text-[10px] text-muted-foreground max-w-lg">
              Score por <strong>taxa</strong> (1 ruim em 4 ≠ 10 ruins em 1000). Vencidos no{" "}
              <strong>dono</strong>, não no advogado. Improcedentes no cálculo como espelho dos
              procedentes.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap rounded-full border bg-muted/40 p-0.5">
          {(
            [
              ["escritorio", "Escritório"],
              ["advogado", "Advogados"],
              ["dono", "Donos (atraso)"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide transition",
                tab === id ? "bg-background shadow text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        {tab === "escritorio" && (
          <MetricsTable rows={offices} nameHeader="Escritório" showVencidos showSub={false} />
        )}
        {tab === "advogado" && (
          <MetricsTable
            rows={lawyers}
            nameHeader="Advogado"
            showVencidos={false}
            showSub
            empty="Sem advogados nos processos"
          />
        )}
        {tab === "dono" && (
          <MetricsTable
            rows={owners}
            nameHeader="Dono (operador)"
            showVencidos
            showSub={false}
            empty="Sem donos atribuídos"
          />
        )}
      </div>

      <div className="px-6 py-3 border-t border-border/30 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Scale className="h-3 w-3 text-emerald-600" /> Proced. % sobre N
        </span>
        <span className="inline-flex items-center gap-1">
          <Gavel className="h-3 w-3 text-red-600" /> Improc. relevante (espelho)
        </span>
        <span className="inline-flex items-center gap-1">
          <Zap className="h-3 w-3 text-violet-600" /> Oport. = oportunidade_instaurar
        </span>
        <span className="inline-flex items-center gap-1">
          <UserCog className="h-3 w-3 text-amber-600" /> Vencidos* só Escritório / Donos
        </span>
      </div>
    </section>
  );
}

function MetricsTable({
  rows,
  nameHeader,
  showVencidos,
  showSub,
  empty,
}: {
  rows: Scored[];
  nameHeader: string;
  showVencidos: boolean;
  showSub?: boolean;
  empty?: string;
}) {
  return (
    <table className="w-full min-w-[920px] text-left">
      <thead>
        <tr className="border-b border-border/40 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
          <th className="px-6 py-3">{nameHeader}</th>
          <th className="px-2 py-3 text-center">N</th>
          <th className="px-2 py-3 text-center text-emerald-700">Proced.</th>
          <th className="px-2 py-3 text-center text-red-700">Improc.</th>
          <th className="px-2 py-3 text-center text-violet-700">Oport.</th>
          <th className="px-2 py-3 text-center text-blue-700">Cumpr.</th>
          <th className="px-2 py-3 text-center text-amber-700">Instaurar</th>
          {showVencidos && (
            <th className="px-2 py-3 text-center text-orange-700">Vencidos*</th>
          )}
          <th className="px-2 py-3 text-center">Taxa P/I</th>
          <th className="px-6 py-3 text-right">Score</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={showVencidos ? 10 : 9}
              className="px-8 py-10 text-center text-[10px] font-black uppercase text-muted-foreground opacity-40"
            >
              {empty || "Sem dados"}
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.key} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
              <td className="px-6 py-3.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold truncate max-w-[200px]">{r.label}</span>
                  {showSub && r.sub && (
                    <span className="text-[9px] text-muted-foreground truncate max-w-[200px]">
                      {r.sub}
                    </span>
                  )}
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {r.score >= 60 ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 border-none text-[8px] font-black gap-0.5">
                        <TrendingUp size={9} /> {r.score}
                      </Badge>
                    ) : r.score >= 40 ? (
                      <Badge className="bg-amber-500/15 text-amber-800 border-none text-[8px] font-black">
                        {r.score}
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/15 text-red-700 border-none text-[8px] font-black gap-0.5">
                        <TrendingDown size={9} /> {r.score}
                      </Badge>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-2 py-3.5 text-center text-[11px] font-black tabular-nums">{r.total}</td>
              <td className="px-2 py-3.5 text-center">
                <CellCountRate n={r.procedentes} rate={r.procedRate} tone="emerald" />
              </td>
              <td className="px-2 py-3.5 text-center">
                <CellCountRate
                  n={r.improcedentesRelevantes || r.improcedentes}
                  rate={r.improcRate}
                  tone="red"
                />
              </td>
              <td className="px-2 py-3.5 text-center">
                <CellCountRate n={r.oportunidade} rate={r.oportRate} tone="violet" />
              </td>
              <td className="px-2 py-3.5 text-center text-[11px] font-black tabular-nums text-blue-700">
                {r.cumprimentoAtivo}
              </td>
              <td className="px-2 py-3.5 text-center text-[11px] font-black tabular-nums text-amber-700">
                {r.faltaInstaurar}
              </td>
              {showVencidos && (
                <td className="px-2 py-3.5 text-center">
                  <CellCountRate n={r.vencidos} rate={r.vencidoRate} tone="orange" />
                </td>
              )}
              <td className="px-2 py-3.5 text-center text-[10px] font-bold tabular-nums text-muted-foreground">
                {r.procedRate.toFixed(0)}% / {r.improcRate.toFixed(0)}%
              </td>
              <td className="px-6 py-3.5 text-right">
                <span
                  className={cn(
                    "text-sm font-black tabular-nums",
                    r.score >= 60
                      ? "text-emerald-600"
                      : r.score >= 40
                        ? "text-amber-600"
                        : "text-red-600"
                  )}
                >
                  {r.score}
                </span>
                <div className="text-[7px] font-bold text-muted-foreground uppercase">/ 100</div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function CellCountRate({
  n,
  rate,
  tone,
}: {
  n: number;
  rate: number;
  tone: "emerald" | "red" | "violet" | "orange";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "red"
        ? "text-red-700"
        : tone === "violet"
          ? "text-violet-700"
          : "text-orange-700";
  return (
    <div className="flex flex-col items-center leading-tight">
      <span className={cn("text-[11px] font-black tabular-nums", color)}>{n}</span>
      <span className="text-[8px] font-bold text-muted-foreground tabular-nums">
        {rate.toFixed(0)}%
      </span>
    </div>
  );
}
