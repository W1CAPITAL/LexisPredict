"use client";

/**
 * Agenda da semana — prazos, atendimentos, novidades e audiências.
 * @copyright 2026 W1 / LexisPredict
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchRepoCases } from "@/app/actions/case-actions";
import { isCasoEncerrado } from "@/lib/status-encerrado";
import {
  buildAtendimentosPorDiaSemana,
  labelSemanaAtual,
  parseUltimoAtendimento,
  weekBounds,
} from "@/lib/atendimento-semana";
import {
  addDays,
  format,
  isSameDay,
  startOfDay,
  parseISO,
  isValid,
  parse,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  Loader2,
  RefreshCcw,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Gavel,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isRecessoForense } from "@/lib/calendario-tj";
import type { LegalCase } from "@/lib/case-logic";
import { traduzirCaso } from "@/lib/traduzir-andamento";

function parsePrazo(c: LegalCase): Date | null {
  const raw =
    (c as any).proximoPrazo ||
    (c as any).proximo_prazo ||
    (c as any).proximo_retorno ||
    (c as any).dataPrazo ||
    (c as any).prazo;
  if (!raw || raw === "-" || raw === "0") return null;
  const s = String(raw).trim();
  try {
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const d = parseISO(s.slice(0, 10));
      return isValid(d) ? startOfDay(d) : null;
    }
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
      const d = parse(s.slice(0, 10), "dd/MM/yyyy", new Date());
      return isValid(d) ? startOfDay(d) : null;
    }
  } catch {
    /* */
  }
  return parseUltimoAtendimento(s);
}

function isNovidade(c: LegalCase) {
  return !!(
    c.tem_atualizacao_pos_retorno ||
    c.tem_novo_andamento ||
    c.djen_nova_comunicacao
  );
}

function isAudiencia(c: LegalCase) {
  const t = String(c.evento_tipo || "");
  return t.startsWith("audiencia") || !!(c as any).tem_audiencia;
}

type DayCell = {
  prazos: LegalCase[];
  atendidos: LegalCase[];
  novidades: LegalCase[];
  audiencias: LegalCase[];
};

export default function AgendaPage() {
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [filtro, setFiltro] = useState<"tudo" | "prazos" | "atendidos" | "novidades">("tudo");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRepoCases();
      if (Array.isArray(data)) setCases(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const weekStart = useMemo(() => weekBounds(anchor).start, [anchor]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const ativos = useMemo(
    () => cases.filter((c) => !isCasoEncerrado(c)),
    [cases]
  );

  const byDay = useMemo(() => {
    const map: Record<string, DayCell> = {};
    for (const d of days) {
      map[format(d, "yyyy-MM-dd")] = {
        prazos: [],
        atendidos: [],
        novidades: [],
        audiencias: [],
      };
    }
    const seenNov: Record<string, Set<string>> = {};
    for (const d of days) {
      seenNov[format(d, "yyyy-MM-dd")] = new Set();
    }

    for (const c of ativos) {
      const prazo = parsePrazo(c);
      if (prazo) {
        const key = format(prazo, "yyyy-MM-dd");
        if (map[key]) map[key].prazos.push(c);
      }
      const ret = parseUltimoAtendimento(
        c.ultimoRetorno || (c as any).ultimo_retorno
      );
      if (ret) {
        const key = format(ret, "yyyy-MM-dd");
        if (map[key]) map[key].atendidos.push(c);
      }
      // Novidade / audiência: coloca no dia do evento se houver data, senão no “hoje” da semana âncora
      const dataEv =
        parsePrazo({
          ...c,
          proximoPrazo:
            c.datajud_ultimo_movimento ||
            c.djen_ultima_data ||
            (c as any).evento_data ||
            null,
        } as any) || null;

      if (isAudiencia(c) && dataEv) {
        const key = format(dataEv, "yyyy-MM-dd");
        if (map[key]) map[key].audiencias.push(c);
      } else if (isAudiencia(c)) {
        // sem data clara: não espalhar em todos os dias
      }

      if (isNovidade(c)) {
        const key = dataEv
          ? format(dataEv, "yyyy-MM-dd")
          : format(startOfDay(anchor), "yyyy-MM-dd");
        if (map[key] && !seenNov[key]?.has(c.protocolo)) {
          map[key].novidades.push(c);
          seenNov[key]?.add(c.protocolo);
        }
      }
    }

    // Ordena prazos por cliente
    for (const key of Object.keys(map)) {
      map[key].prazos.sort((a, b) =>
        String(a.cliente || "").localeCompare(String(b.cliente || ""))
      );
      map[key].atendidos.sort((a, b) =>
        String(a.cliente || "").localeCompare(String(b.cliente || ""))
      );
    }
    return map;
  }, [ativos, days, anchor]);

  const serie = useMemo(
    () => buildAtendimentosPorDiaSemana(ativos, anchor),
    [ativos, anchor]
  );

  const kpis = useMemo(() => {
    let prazos = 0;
    let atendidos = 0;
    let novidades = 0;
    let audiencias = 0;
    let vencidosNaSemana = 0;
    const hoje = startOfDay(new Date());
    for (const d of days) {
      const key = format(d, "yyyy-MM-dd");
      const cell = byDay[key];
      if (!cell) continue;
      prazos += cell.prazos.length;
      atendidos += cell.atendidos.length;
      novidades += cell.novidades.length;
      audiencias += cell.audiencias.length;
      if (d < hoje) vencidosNaSemana += cell.prazos.length;
    }
    const hojeKey = format(hoje, "yyyy-MM-dd");
    const prazosHoje = byDay[hojeKey]?.prazos.length || 0;
    return { prazos, atendidos, novidades, audiencias, vencidosNaSemana, prazosHoje };
  }, [byDay, days]);

  const hoje = startOfDay(new Date());

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" /> Agenda da
                  semana
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {labelSemanaAtual(anchor)} · prazos, atendimentos, novidades e
                  audiências
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAnchor(addDays(weekStart, -7))}
              >
                ← Semana
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAnchor(new Date())}
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAnchor(addDays(weekStart, 7))}
              >
                Semana →
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={load}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </header>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { label: "Prazos na semana", value: kpis.prazos, tone: "amber" },
              { label: "Prazos hoje", value: kpis.prazosHoje, tone: "blue" },
              {
                label: "Já vencidos (dias passados)",
                value: kpis.vencidosNaSemana,
                tone: "red",
              },
              {
                label: "Atendimentos",
                value: kpis.atendidos,
                tone: "sky",
              },
              {
                label: "Novidades",
                value: kpis.novidades,
                tone: "violet",
              },
              {
                label: "Audiências",
                value: kpis.audiencias,
                tone: "cyan",
              },
            ].map((k) => (
              <div
                key={k.label}
                className="rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <p className="text-[10px] text-muted-foreground font-medium">
                  {k.label}
                </p>
                <p className="text-xl font-bold tabular-nums mt-0.5">{k.value}</p>
              </div>
            ))}
          </div>

          {/* Filtro */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["tudo", "Tudo"],
                ["prazos", "Só prazos"],
                ["atendidos", "Só atendidos"],
                ["novidades", "Só novidades"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                size="sm"
                variant={filtro === id ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setFiltro(id)}
              >
                {label}
              </Button>
            ))}
          </div>

          {/* Série de atendimentos */}
          {serie?.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] font-semibold text-muted-foreground mb-2">
                Atendimentos por dia
              </p>
              <div className="flex items-end gap-1.5 h-16">
                {serie.map((s: any) => {
                  const max = Math.max(
                    1,
                    ...serie.map((x: any) => Number(x.count || x.total || 0))
                  );
                  const n = Number(s.count ?? s.total ?? 0);
                  const h = Math.round((n / max) * 100);
                  return (
                    <div
                      key={String(s.day || s.data || s.label)}
                      className="flex-1 flex flex-col items-center gap-1"
                      title={`${s.label || s.day}: ${n}`}
                    >
                      <div
                        className="w-full rounded-t bg-primary/80 min-h-[2px]"
                        style={{ height: `${Math.max(h, n > 0 ? 12 : 2)}%` }}
                      />
                      <span className="text-[9px] text-muted-foreground tabular-nums">
                        {n}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loading && cases.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando agenda…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
              {days.map((d) => {
                const key = format(d, "yyyy-MM-dd");
                const cell = byDay[key] || {
                  prazos: [],
                  atendidos: [],
                  novidades: [],
                  audiencias: [],
                };
                const isToday = isSameDay(d, hoje);
                const isPast = d < hoje && !isToday;
                const recesso = isRecessoForense(d);

                const showPrazos = filtro === "tudo" || filtro === "prazos";
                const showAt = filtro === "tudo" || filtro === "atendidos";
                const showNov = filtro === "tudo" || filtro === "novidades";

                const totalVisible =
                  (showPrazos ? cell.prazos.length : 0) +
                  (showAt ? cell.atendidos.length : 0) +
                  (showNov ? cell.novidades.length : 0) +
                  (filtro === "tudo" ? cell.audiencias.length : 0);

                return (
                  <div
                    key={key}
                    className={cn(
                      "rounded-xl border bg-card flex flex-col min-h-[220px]",
                      isToday
                        ? "border-primary ring-1 ring-primary/30"
                        : "border-border",
                      isPast && "opacity-90"
                    )}
                  >
                    <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                          {format(d, "EEE", { locale: ptBR })}
                        </p>
                        <p
                          className={cn(
                            "text-lg font-bold tabular-nums",
                            isToday && "text-primary"
                          )}
                        >
                          {format(d, "dd")}
                        </p>
                        {recesso && (
                          <p className="text-[9px] text-amber-700 font-medium">Recesso</p>
                        )}
                      </div>
                      {totalVisible > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {totalVisible}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[320px] p-2">
                      {showPrazos &&
                        cell.prazos.map((c) => (
                          <Link
                            key={`p-${c.protocolo}`}
                            href={`/cases?search=${encodeURIComponent(c.protocolo || "")}`}
                            className={cn(
                              "block rounded-lg border px-2 py-1.5 text-[10px] hover:opacity-90",
                              isPast
                                ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900"
                                : isToday
                                  ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30"
                                  : "bg-amber-50 border-amber-200 dark:bg-amber-950/30"
                            )}
                          >
                            <span className="font-bold flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {isPast ? "VENCIDO" : isToday ? "HOJE" : "PRAZO"}
                            </span>
                            <p className="font-semibold text-foreground truncate">
                              {c.cliente}
                            </p>
                            <p className="text-muted-foreground font-mono truncate">
                              {c.protocolo}
                            </p>
                          </Link>
                        ))}

                      {filtro === "tudo" &&
                        cell.audiencias.map((c) => (
                          <Link
                            key={`aud-${c.protocolo}`}
                            href={`/cases?search=${encodeURIComponent(c.protocolo || "")}`}
                            className="block rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 px-2 py-1.5 text-[10px]"
                          >
                            <span className="font-bold flex items-center gap-1 text-cyan-800">
                              <Gavel className="h-3 w-3" /> AUDIÊNCIA
                            </span>
                            <p className="font-semibold truncate">{c.cliente}</p>
                          </Link>
                        ))}

                      {showNov &&
                        cell.novidades.map((c) => {
                          const leigo = traduzirCaso(c);
                          return (
                            <Link
                              key={`n-${c.protocolo}`}
                              href={`/cases?search=${encodeURIComponent(c.protocolo || "")}`}
                              className="block rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 px-2 py-1.5 text-[10px]"
                            >
                              <span className="font-bold flex items-center gap-1 text-violet-800">
                                <Sparkles className="h-3 w-3" /> NOVIDADE
                              </span>
                              <p className="font-semibold truncate">{c.cliente}</p>
                              <p className="text-muted-foreground line-clamp-2">
                                {leigo.tituloLeigo}
                              </p>
                            </Link>
                          );
                        })}

                      {showAt &&
                        cell.atendidos.map((c) => (
                          <Link
                            key={`a-${c.protocolo}`}
                            href={`/cases?search=${encodeURIComponent(c.protocolo || "")}`}
                            className="block rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 px-2 py-1.5 text-[10px]"
                          >
                            <span className="font-bold flex items-center gap-1 text-sky-800">
                              <CheckCircle2 className="h-3 w-3" /> ATENDIDO
                            </span>
                            <p className="font-semibold truncate">{c.cliente}</p>
                          </Link>
                        ))}

                      {totalVisible === 0 && (
                        <p className="text-[10px] text-muted-foreground text-center py-8">
                          Livre
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Prazos usam o próximo prazo da carteira (aceita ISO e dd/MM/yyyy).
            Atendidos usam o último retorno. Novidades usam flags de pós-retorno /
            DJEN. Clique no card para abrir o processo.
          </p>
        </div>
      </main>
    </div>
  );
}
