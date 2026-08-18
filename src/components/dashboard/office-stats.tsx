"use client";

/**
 * Telemetria de Performance por Escritório + Ranking de Advogados.
 * Inclui: procedentes, sucumbência/oportunidade honorários, cumprimento, BA, novidades.
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
  User,
  Zap,
} from "lucide-react";

interface OfficeStatsProps {
  cases: LegalCase[];
  className?: string;
}

type OfficeRow = {
  name: string;
  total: number;
  ativos: number;
  vencidos: number;
  alerta: number;
  encerrados: number;
  baixasTribunal: number;
  procedentes: number;
  improcedentes: number;
  cumprimentoAtivo: number;
  faltaInstaurar: number;
  sucumbencia: number; // oportunidade honorários elegível
  oportunidadeScoreSum: number;
  ba: number;
  novidades: number;
  atendidosSemana: number;
  score: number;
};

type AdvRow = {
  name: string;
  escritorio: string;
  total: number;
  ativos: number;
  procedentes: number;
  cumprimentoAtivo: number;
  faltaInstaurar: number;
  sucumbencia: number;
  baixasTribunal: number;
  vencidos: number;
  novidades: number;
  score: number;
};

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
  const d = dadosOf(c);
  return !!d.cumprimento_pendente_necessario;
}

/** Sucumbência / oportunidade de honorários (camada comercial do scanner). */
function isSucumbenciaOportunidade(c: LegalCase): boolean {
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
  // sucumbência explícita ou elegível com score de cobrança
  if (tipo.includes("sucumb")) return elegivel || score >= 40;
  return elegivel && score >= 55;
}

function oportunidadeScore(c: LegalCase): number {
  const d = dadosOf(c);
  const op =
    (c as any).oportunidade_instaurar ||
    d.oportunidade_instaurar ||
    d.detalhes_execucao?.oportunidade_instaurar;
  return Number((c as any).oportunidade_score ?? op?.score ?? 0) || 0;
}

function isBA(c: LegalCase): boolean {
  return !!(c as any).indicio_busca_apreensao || !!dadosOf(c).indicio_busca_apreensao;
}

function isAtendidoSemana(c: LegalCase): boolean {
  const raw = String(c.ultimoRetorno || (c as any).ultimo_retorno || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const d = new Date(raw + "T12:00:00");
  const now = new Date();
  const day = now.getDay(); // 0 dom
  const diff = day === 0 ? 6 : day - 1; // segunda = início
  const start = new Date(now);
  start.setDate(now.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return d >= start && d <= now;
}

function scoreOffice(g: Omit<OfficeRow, "score" | "name">): number {
  // Procedente / sucumbência / cumprimento pesam positivamente; vencido e BA pesam negativamente
  return (
    g.procedentes * 20 +
    g.sucumbencia * 35 +
    g.cumprimentoAtivo * 12 +
    g.faltaInstaurar * 8 +
    g.encerrados * 6 +
    g.atendidosSemana * 10 +
    g.ativos * 1 -
    g.vencidos * 25 -
    g.ba * 15 -
    Math.max(0, g.improcedentes) * 5
  );
}

function scoreAdv(g: Omit<AdvRow, "score" | "name" | "escritorio">): number {
  return (
    g.procedentes * 20 +
    g.sucumbencia * 35 +
    g.cumprimentoAtivo * 12 +
    g.faltaInstaurar * 8 +
    g.baixasTribunal * 4 +
    g.ativos * 1 -
    g.vencidos * 25
  );
}

export function OfficeStats({ cases, className }: OfficeStatsProps) {
  const [tab, setTab] = useState<"escritorio" | "advogado">("escritorio");

  const { offices, lawyers } = useMemo(() => {
    const uniqueMap = new Map<string, LegalCase>();
    cases.forEach((c) => {
      if (c?.protocolo) uniqueMap.set(c.protocolo, c);
    });

    const officeGroups: Record<string, Omit<OfficeRow, "score">> = {};
    const advGroups: Record<string, Omit<AdvRow, "score">> = {};

    uniqueMap.forEach((c) => {
      const officeName = (c.escritorio || "Sem Escritório").trim().toUpperCase() || "SEM ESCRITÓRIO";
      const advName = (c.advogado || "Sem advogado").trim().toUpperCase() || "SEM ADVOGADO";

      if (!officeGroups[officeName]) {
        officeGroups[officeName] = {
          name: officeName,
          total: 0,
          ativos: 0,
          vencidos: 0,
          alerta: 0,
          encerrados: 0,
          baixasTribunal: 0,
          procedentes: 0,
          improcedentes: 0,
          cumprimentoAtivo: 0,
          faltaInstaurar: 0,
          sucumbencia: 0,
          oportunidadeScoreSum: 0,
          ba: 0,
          novidades: 0,
          atendidosSemana: 0,
        };
      }
      const og = officeGroups[officeName];
      og.total++;

      const encerrado = isCasoEncerrado(c);
      if (encerrado) og.encerrados++;
      else {
        og.ativos++;
        if (c.status === "Vencido" || c.status === "Caso Crítico") og.vencidos++;
        else if (["É Hoje", "Atenção"].includes(String(c.status))) og.alerta++;
      }

      if (isBaixaTribunal(c)) og.baixasTribunal++;
      if (isSentencaProcedente(c as any)) og.procedentes++;
      if (isSentencaImprocedente(c as any)) og.improcedentes++;
      if (isCumprimentoAtivo(c)) og.cumprimentoAtivo++;
      if (isFaltaInstaurar(c)) og.faltaInstaurar++;
      if (isSucumbenciaOportunidade(c)) og.sucumbencia++;
      og.oportunidadeScoreSum += oportunidadeScore(c);
      if (isBA(c)) og.ba++;
      if (resolveTemNovoAndamento(c as any)) og.novidades++;
      if (isAtendidoSemana(c)) og.atendidosSemana++;

      const advKey = `${advName}||${officeName}`;
      if (!advGroups[advKey]) {
        advGroups[advKey] = {
          name: advName,
          escritorio: officeName,
          total: 0,
          ativos: 0,
          procedentes: 0,
          cumprimentoAtivo: 0,
          faltaInstaurar: 0,
          sucumbencia: 0,
          baixasTribunal: 0,
          vencidos: 0,
          novidades: 0,
        };
      }
      const ag = advGroups[advKey];
      ag.total++;
      if (!encerrado) {
        ag.ativos++;
        if (c.status === "Vencido" || c.status === "Caso Crítico") ag.vencidos++;
      }
      if (isSentencaProcedente(c as any)) ag.procedentes++;
      if (isCumprimentoAtivo(c)) ag.cumprimentoAtivo++;
      if (isFaltaInstaurar(c)) ag.faltaInstaurar++;
      if (isSucumbenciaOportunidade(c)) ag.sucumbencia++;
      if (isBaixaTribunal(c)) ag.baixasTribunal++;
      if (resolveTemNovoAndamento(c as any)) ag.novidades++;
    });

    const offices: OfficeRow[] = Object.values(officeGroups)
      .map((g) => ({ ...g, score: scoreOffice(g) }))
      .sort((a, b) => b.score - a.score);

    const lawyers: AdvRow[] = Object.values(advGroups)
      .map((g) => ({ ...g, score: scoreAdv(g) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);

    return { offices, lawyers };
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
            <p className="text-[10px] text-muted-foreground">
              Procedentes · sucumbência · cumprimento · ranking por escritório e advogado
            </p>
          </div>
        </div>
        <div className="flex rounded-full border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setTab("escritorio")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide transition",
              tab === "escritorio" ? "bg-background shadow text-foreground" : "text-muted-foreground"
            )}
          >
            Por escritório
          </button>
          <button
            type="button"
            onClick={() => setTab("advogado")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide transition",
              tab === "advogado" ? "bg-background shadow text-foreground" : "text-muted-foreground"
            )}
          >
            Ranking advogados
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {tab === "escritorio" ? (
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-border/40 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                <th className="px-6 py-3">Escritório</th>
                <th className="px-3 py-3 text-center">Total</th>
                <th className="px-3 py-3 text-center">Ativos</th>
                <th className="px-3 py-3 text-center text-emerald-700">Proced.</th>
                <th className="px-3 py-3 text-center text-violet-700">Sucumb.</th>
                <th className="px-3 py-3 text-center text-blue-700">Cumpr.</th>
                <th className="px-3 py-3 text-center text-amber-700">Instaurar</th>
                <th className="px-3 py-3 text-center">Baixa TJ</th>
                <th className="px-3 py-3 text-center text-red-700">Vencidos</th>
                <th className="px-3 py-3 text-center">Novid.</th>
                <th className="px-3 py-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {offices.map((o) => (
                <tr key={o.name} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold truncate max-w-[180px]">{o.name}</span>
                      <div className="flex flex-wrap gap-1">
                        {o.sucumbencia > 0 && (
                          <Badge className="bg-violet-500/15 text-violet-700 border-none text-[8px] font-black">
                            {o.sucumbencia} honorários
                          </Badge>
                        )}
                        {o.ba > 0 && (
                          <Badge className="bg-red-500/15 text-red-700 border-none text-[8px] font-black">
                            {o.ba} B.A.
                          </Badge>
                        )}
                        {o.score >= 0 ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 border-none text-[8px] font-black gap-0.5">
                            <TrendingUp size={9} /> OK
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500 text-white border-none text-[8px] font-black gap-0.5">
                            <TrendingDown size={9} /> Risco
                          </Badge>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-center text-[11px] font-black tabular-nums">{o.total}</td>
                  <td className="px-3 py-3.5 text-center text-[11px] font-black tabular-nums text-muted-foreground">
                    {o.ativos}
                  </td>
                  <td className="px-3 py-3.5 text-center text-[11px] font-black tabular-nums text-emerald-700">
                    {o.procedentes}
                  </td>
                  <td className="px-3 py-3.5 text-center text-[11px] font-black tabular-nums text-violet-700">
                    {o.sucumbencia}
                  </td>
                  <td className="px-3 py-3.5 text-center text-[11px] font-black tabular-nums text-blue-700">
                    {o.cumprimentoAtivo}
                  </td>
                  <td className="px-3 py-3.5 text-center text-[11px] font-black tabular-nums text-amber-700">
                    {o.faltaInstaurar}
                  </td>
                  <td className="px-3 py-3.5 text-center text-[11px] font-black tabular-nums">
                    {o.baixasTribunal}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-3.5 text-center text-[11px] font-black tabular-nums",
                      o.vencidos > 0 ? "text-red-600" : "text-muted-foreground/40"
                    )}
                  >
                    {o.vencidos}
                  </td>
                  <td className="px-3 py-3.5 text-center text-[11px] font-black tabular-nums">
                    {o.novidades}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span
                      className={cn(
                        "text-xs font-black tabular-nums",
                        o.score >= 0 ? "text-emerald-600" : "text-red-600"
                      )}
                    >
                      {o.score > 0 ? `+${o.score}` : o.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[800px] text-left">
            <thead>
              <tr className="border-b border-border/40 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                <th className="px-6 py-3">#</th>
                <th className="px-3 py-3">Advogado</th>
                <th className="px-3 py-3">Escritório</th>
                <th className="px-3 py-3 text-center">Carteira</th>
                <th className="px-3 py-3 text-center text-emerald-700">Proced.</th>
                <th className="px-3 py-3 text-center text-violet-700">Sucumb.</th>
                <th className="px-3 py-3 text-center text-blue-700">Cumpr.</th>
                <th className="px-3 py-3 text-center text-amber-700">Instaurar</th>
                <th className="px-3 py-3 text-center text-red-700">Vencidos</th>
                <th className="px-6 py-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {lawyers.map((a, i) => (
                <tr key={`${a.name}-${a.escritorio}`} className="border-b border-border/20 hover:bg-muted/30">
                  <td className="px-6 py-3 text-[11px] font-black text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-bold truncate max-w-[160px]">{a.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[10px] text-muted-foreground truncate max-w-[120px]">
                    {a.escritorio}
                  </td>
                  <td className="px-3 py-3 text-center text-[11px] font-black tabular-nums">{a.total}</td>
                  <td className="px-3 py-3 text-center text-[11px] font-black tabular-nums text-emerald-700">
                    {a.procedentes}
                  </td>
                  <td className="px-3 py-3 text-center text-[11px] font-black tabular-nums text-violet-700">
                    {a.sucumbencia}
                  </td>
                  <td className="px-3 py-3 text-center text-[11px] font-black tabular-nums text-blue-700">
                    {a.cumprimentoAtivo}
                  </td>
                  <td className="px-3 py-3 text-center text-[11px] font-black tabular-nums text-amber-700">
                    {a.faltaInstaurar}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-3 text-center text-[11px] font-black tabular-nums",
                      a.vencidos > 0 ? "text-red-600" : "text-muted-foreground/40"
                    )}
                  >
                    {a.vencidos}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span
                      className={cn(
                        "text-xs font-black tabular-nums",
                        a.score >= 0 ? "text-emerald-600" : "text-red-600"
                      )}
                    >
                      {a.score > 0 ? `+${a.score}` : a.score}
                    </span>
                  </td>
                </tr>
              ))}
              {lawyers.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-8 py-10 text-center text-[10px] font-black uppercase text-muted-foreground opacity-40">
                    Sem advogados nos processos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-6 py-3 border-t border-border/30 flex flex-wrap gap-3 text-[9px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Scale className="h-3 w-3 text-emerald-600" /> Proced. = is_procedente / scanner
        </span>
        <span className="inline-flex items-center gap-1">
          <Gavel className="h-3 w-3 text-violet-600" /> Sucumb. = oportunidade honorários elegível
        </span>
        <span className="inline-flex items-center gap-1">
          <Zap className="h-3 w-3 text-blue-600" /> Cumpr. = fase 156 / em cumprimento
        </span>
      </div>
    </section>
  );
}
