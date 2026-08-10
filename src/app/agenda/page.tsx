"use client";

/**
 * Agenda operacional — visão semana/dia/lista com eventos coloridos
 * (inspirado em event-calendar ReUI: chips, cores por tipo, detalhe ao clicar).
 * Dados reais da carteira: prazos, audiências, novidades, atendimentos.
 * @copyright 2026 W1 / LexisPredict
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchRepoCases } from "@/app/actions/case-actions";
import { isCasoEncerrado } from "@/lib/status-encerrado";
import {
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
  List,
  Clock,
  ExternalLink,
  X,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isRecessoForense } from "@/lib/calendario-tj";
import { normalizarDataPrazo, hojeBrasilISO } from "@/lib/prazo-status";
import type { LegalCase } from "@/lib/case-logic";
import { traduzirCaso } from "@/lib/traduzir-andamento";

/** Cores por tipo de evento (leitura rápida da semana) */
const EVENT_TYPE = {
  prazo: {
    label: "Prazo",
    color: "var(--color-amber-500, #f59e0b)",
    chip: "bg-amber-50 border-amber-200 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100",
    bar: "bg-amber-500",
  },
  audiencia: {
    label: "Audiência",
    color: "var(--color-rose-500, #f43f5e)",
    chip: "bg-rose-50 border-rose-200 text-rose-950 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-100",
    bar: "bg-rose-500",
  },
  novidade: {
    label: "Novidade",
    color: "var(--color-violet-500, #8b5cf6)",
    chip: "bg-violet-50 border-violet-200 text-violet-950 dark:bg-violet-950/40 dark:border-violet-800 dark:text-violet-100",
    bar: "bg-violet-500",
  },
  atendido: {
    label: "Atendido",
    color: "var(--color-sky-500, #0ea5e9)",
    chip: "bg-sky-50 border-sky-200 text-sky-950 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-100",
    bar: "bg-sky-500",
  },
} as const;

type EventKind = keyof typeof EVENT_TYPE;

type AgendaEvent = {
  id: string;
  kind: EventKind;
  date: Date;
  case: LegalCase;
  title: string;
  subtitle?: string;
};

function parsePrazo(c: LegalCase): Date | null {
  const raw =
    (c as any).proximoPrazo ||
    (c as any).proximo_prazo ||
    (c as any).proximo_retorno ||
    (c as any).dataPrazo ||
    (c as any).prazo;
  if (!raw || raw === "-" || raw === "0") return null;
  const norm = normalizarDataPrazo(String(raw));
  if (norm) {
    const [y, m, d] = norm.split("-").map(Number);
    return startOfDay(new Date(y, m - 1, d));
  }
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

function initials(name?: string) {
  const p = String(name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function EventChip({
  ev,
  onSelect,
  dense,
}: {
  ev: AgendaEvent;
  onSelect: (e: AgendaEvent) => void;
  dense?: boolean;
}) {
  const meta = EVENT_TYPE[ev.kind];
  return (
    <button
      type="button"
      onClick={() => onSelect(ev)}
      className={cn(
        "w-full text-left rounded-lg border px-2 py-1.5 transition-all hover:shadow-md hover:-translate-y-0.5",
        meta.chip,
        dense && "py-1"
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={cn("h-full w-1 self-stretch rounded-full shrink-0", meta.bar)} />
        <Avatar className="size-5 shrink-0">
          <AvatarFallback className="text-[9px] font-semibold bg-background/60">
            {initials(ev.case.cliente)}
          </AvatarFallback>
        </Avatar>
        <span className="truncate text-[11px] font-medium">{ev.title}</span>
      </span>
      {!dense && ev.subtitle && (
        <span className="block truncate ps-6 text-[10px] opacity-80 mt-0.5">
          {ev.subtitle}
        </span>
      )}
    </button>
  );
}

export default function AgendaPage() {
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [view, setView] = useState<"week" | "day" | "agenda">("week");
  const [filtro, setFiltro] = useState<"tudo" | EventKind>("tudo");
  const [selected, setSelected] = useState<AgendaEvent | null>(null);

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

  /** Lista plana de eventos coloridos */
  const events = useMemo(() => {
    const out: AgendaEvent[] = [];
    for (const c of ativos) {
      const prazo = parsePrazo(c);
      if (prazo) {
        out.push({
          id: `prazo-${c.protocolo}`,
          kind: "prazo",
          date: prazo,
          case: c,
          title: c.cliente || c.protocolo || "Cliente",
          subtitle: c.protocolo || undefined,
        });
      }
      if (isAudiencia(c) && prazo) {
        out.push({
          id: `aud-${c.protocolo}`,
          kind: "audiencia",
          date: prazo,
          case: c,
          title: c.cliente || "Audiência",
          subtitle: String(c.evento_resumo || c.evento_tipo || "Audiência"),
        });
      }
      if (isNovidade(c)) {
        const d =
          parsePrazo(c) ||
          parseUltimoAtendimento(
            (c as any).datajud_ultimo_movimento ||
              (c as any).djen_ultima_data ||
              null
          ) ||
          startOfDay(new Date());
        const leigo = traduzirCaso(c);
        out.push({
          id: `nov-${c.protocolo}`,
          kind: "novidade",
          date: d,
          case: c,
          title: c.cliente || "Novidade",
          subtitle: leigo.tituloLeigo || c.evento_resumo || undefined,
        });
      }
      const ret = parseUltimoAtendimento(
        (c as any).ultimoRetorno || (c as any).ultimo_retorno || null
      );
      if (ret) {
        out.push({
          id: `at-${c.protocolo}-${format(ret, "yyyy-MM-dd")}`,
          kind: "atendido",
          date: ret,
          case: c,
          title: c.cliente || "Atendido",
          subtitle: "Retorno registrado",
        });
      }
    }
    return out.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [ativos]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, AgendaEvent[]> = {};
    for (const d of days) {
      map[format(d, "yyyy-MM-dd")] = [];
    }
    for (const ev of events) {
      const key = format(ev.date, "yyyy-MM-dd");
      if (!map[key]) continue;
      if (filtro !== "tudo" && ev.kind !== filtro) continue;
      map[key].push(ev);
    }
    return map;
  }, [events, days, filtro]);

  const dayEvents = useMemo(() => {
    const key = format(selectedDay, "yyyy-MM-dd");
    return (eventsByDay[key] || []).filter(
      (e) => filtro === "tudo" || e.kind === filtro
    );
  }, [eventsByDay, selectedDay, filtro]);

  const kpis = useMemo(() => {
    let prazos = 0,
      atendidos = 0,
      novidades = 0,
      audiencias = 0,
      vencidos = 0;
    const hoje = startOfDay(new Date());
    for (const d of days) {
      const list = eventsByDay[format(d, "yyyy-MM-dd")] || [];
      for (const e of list) {
        if (e.kind === "prazo") {
          prazos++;
          if (d < hoje) vencidos++;
        }
        if (e.kind === "atendido") atendidos++;
        if (e.kind === "novidade") novidades++;
        if (e.kind === "audiencia") audiencias++;
      }
    }
    const hojeKey = format(hoje, "yyyy-MM-dd");
    const prazosHoje = (eventsByDay[hojeKey] || []).filter(
      (e) => e.kind === "prazo"
    ).length;
    return { prazos, atendidos, novidades, audiencias, vencidos, prazosHoje };
  }, [days, eventsByDay]);

  const selectedLeigo = selected ? traduzirCaso(selected.case) : null;

  return (
    <div className="ops-ui flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
            {/* Toolbar estilo event-calendar */}
            <Card className="py-0 overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2.5">
                  <Button variant="ghost" size="icon" asChild className="shrink-0">
                    <Link href="/">
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base font-semibold tracking-tight flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      Agenda
                    </h1>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {labelSemanaAtual(anchor)} · prazos, audiências, novidades e
                      retornos
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      variant={view === "week" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setView("week")}
                    >
                      Semana
                    </Button>
                    <Button
                      variant={view === "day" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setView("day")}
                    >
                      Dia
                    </Button>
                    <Button
                      variant={view === "agenda" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setView("agenda")}
                    >
                      <List className="h-3.5 w-3.5 mr-1" />
                      Lista
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAnchor(addDays(weekStart, -7))}
                    >
                      ←
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const t = new Date();
                        setAnchor(t);
                        setSelectedDay(startOfDay(t));
                      }}
                    >
                      Hoje
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAnchor(addDays(weekStart, 7))}
                    >
                      →
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
                </div>

                {/* KPIs + legend */}
                <div className="px-3 py-3 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {[
                      {
                        label: "Prazos na semana",
                        value: kpis.prazos,
                        tone: "text-amber-700",
                      },
                      {
                        label: "Prazos hoje",
                        value: kpis.prazosHoje,
                        tone: "text-blue-700",
                      },
                      {
                        label: "Vencidos (dias passados)",
                        value: kpis.vencidos,
                        tone: "text-red-700",
                      },
                      {
                        label: "Novidades",
                        value: kpis.novidades,
                        tone: "text-violet-700",
                      },
                      {
                        label: "Audiências",
                        value: kpis.audiencias,
                        tone: "text-rose-700",
                      },
                      {
                        label: "Atendidos",
                        value: kpis.atendidos,
                        tone: "text-sky-700",
                      },
                    ].map((k) => (
                      <div
                        key={k.label}
                        className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2"
                      >
                        <p className="text-[10px] text-muted-foreground font-medium">
                          {k.label}
                        </p>
                        <p
                          className={cn(
                            "text-xl font-semibold tabular-nums",
                            k.tone
                          )}
                        >
                          {loading ? "…" : k.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ["tudo", "Tudo"],
                        ["prazo", "Prazos"],
                        ["audiencia", "Audiências"],
                        ["novidade", "Novidades"],
                        ["atendido", "Atendidos"],
                      ] as const
                    ).map(([k, label]) => (
                      <Button
                        key={k}
                        size="sm"
                        variant={filtro === k ? "default" : "outline"}
                        className="h-7 text-[11px]"
                        onClick={() => setFiltro(k)}
                      >
                        {k !== "tudo" && (
                          <span
                            className={cn(
                              "mr-1.5 size-2 rounded-full",
                              EVENT_TYPE[k as EventKind].bar
                            )}
                          />
                        )}
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
              {/* Main calendar area */}
              <div className="min-w-0 space-y-3">
                {view === "week" && (
                  <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
                    {days.map((d) => {
                      const key = format(d, "yyyy-MM-dd");
                      const list = eventsByDay[key] || [];
                      const isToday = isSameDay(d, new Date());
                      const isSel = isSameDay(d, selectedDay);
                      const recesso = isRecessoForense(d);
                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => {
                            setSelectedDay(d);
                            setView("day");
                          }}
                          className={cn(
                            "text-left rounded-xl border bg-card p-2 min-h-[140px] transition-all hover:shadow-md",
                            isToday && "ring-2 ring-primary/40",
                            isSel && "border-primary",
                            recesso && "bg-amber-50/40 dark:bg-amber-950/20"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground uppercase">
                                {format(d, "EEE", { locale: ptBR })}
                              </p>
                              <p
                                className={cn(
                                  "text-lg font-semibold tabular-nums",
                                  isToday && "text-primary"
                                )}
                              >
                                {format(d, "dd")}
                              </p>
                            </div>
                            {recesso && (
                              <Badge
                                variant="outline"
                                className="text-[9px] text-amber-800"
                              >
                                Recesso
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1">
                            {list.slice(0, 4).map((ev) => (
                              <EventChip
                                key={ev.id}
                                ev={ev}
                                dense
                                onSelect={(e) => {
                                  setSelected(e);
                                  setSelectedDay(d);
                                }}
                              />
                            ))}
                            {list.length > 4 && (
                              <p className="text-[10px] text-muted-foreground text-center">
                                +{list.length - 4} mais
                              </p>
                            )}
                            {list.length === 0 && (
                              <p className="text-[10px] text-muted-foreground text-center py-6">
                                Livre
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {view === "day" && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">
                            {format(selectedDay, "EEEE, dd 'de' MMMM", {
                              locale: ptBR,
                            })}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {dayEvents.length} evento
                            {dayEvents.length !== 1 ? "s" : ""}
                            {isRecessoForense(selectedDay)
                              ? " · recesso forense"
                              : ""}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setSelectedDay(addDays(selectedDay, -1))
                            }
                          >
                            ←
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setSelectedDay(addDays(selectedDay, 1))
                            }
                          >
                            →
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {dayEvents.map((ev) => (
                          <EventChip
                            key={ev.id}
                            ev={ev}
                            onSelect={setSelected}
                          />
                        ))}
                        {dayEvents.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-12">
                            Nenhum evento neste dia com o filtro atual.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {view === "agenda" && (
                  <Card>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[520px]">
                        <ul className="divide-y divide-border/60">
                          {events
                            .filter(
                              (e) =>
                                (filtro === "tudo" || e.kind === filtro) &&
                                e.date >= weekStart &&
                                e.date < addDays(weekStart, 7)
                            )
                            .map((ev) => (
                              <li key={ev.id}>
                                <button
                                  type="button"
                                  onClick={() => setSelected(ev)}
                                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                                >
                                  <span
                                    className={cn(
                                      "mt-1 size-2.5 rounded-full shrink-0",
                                      EVENT_TYPE[ev.kind].bar
                                    )}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-muted-foreground tabular-nums">
                                        {format(ev.date, "dd/MM")}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className="text-[9px]"
                                      >
                                        {EVENT_TYPE[ev.kind].label}
                                      </Badge>
                                    </div>
                                    <p className="text-sm font-medium truncate">
                                      {ev.title}
                                    </p>
                                    {ev.subtitle && (
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        {ev.subtitle}
                                      </p>
                                    )}
                                  </div>
                                  <Avatar className="size-7 shrink-0">
                                    <AvatarFallback className="text-[10px]">
                                      {initials(ev.case.cliente)}
                                    </AvatarFallback>
                                  </Avatar>
                                </button>
                              </li>
                            ))}
                        </ul>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Clique no evento para ver o detalhe. Cores: prazo (âmbar),
                  audiência (rosa), novidade (violeta), atendido (azul). Recesso
                  forense marcado nos dias. Não é agenda de marcação livre —
                  espelha a carteira e a telemetria.
                </p>
              </div>

              {/* Detail panel (inspirado no DetailPanel da dica) */}
              <aside className="lg:sticky lg:top-4">
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    {!selected ? (
                      <div className="p-6 text-center space-y-2 text-muted-foreground">
                        <Clock className="h-8 w-8 mx-auto opacity-40" />
                        <p className="text-sm font-medium text-foreground">
                          Detalhe do evento
                        </p>
                        <p className="text-xs">
                          Selecione um prazo, audiência ou novidade na agenda.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
                          <div className="min-w-0">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] mb-1",
                                EVENT_TYPE[selected.kind].chip
                              )}
                            >
                              {EVENT_TYPE[selected.kind].label}
                            </Badge>
                            <p className="text-sm font-semibold truncate">
                              {selected.case.cliente}
                            </p>
                            <p className="text-[11px] font-mono text-muted-foreground truncate">
                              {selected.case.protocolo}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="shrink-0"
                            onClick={() => setSelected(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="px-4 py-3 space-y-3 text-xs">
                          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                            <p className="text-[10px] text-muted-foreground font-medium">
                              Em linguagem simples
                            </p>
                            <p className="text-sm font-medium mt-0.5">
                              {selectedLeigo?.tituloLeigo}
                            </p>
                            <p className="text-muted-foreground mt-1 leading-relaxed">
                              {selectedLeigo?.detalheLeigo}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Row
                              icon={<CalendarDays className="size-3.5" />}
                              label="Data"
                              value={format(selected.date, "dd/MM/yyyy")}
                            />
                            <Row
                              icon={<Gavel className="size-3.5" />}
                              label="Tribunal"
                              value={String(selected.case.tribunal || "—")}
                            />
                            <Row
                              icon={<AlertTriangle className="size-3.5" />}
                              label="Status"
                              value={String(selected.case.status || "—")}
                            />
                            {selected.case.escritorio && (
                              <Row
                                icon={<CheckCircle2 className="size-3.5" />}
                                label="Unidade"
                                value={String(selected.case.escritorio)}
                              />
                            )}
                          </div>

                          <div className="flex flex-col gap-2 pt-1">
                            <Button asChild size="sm" className="w-full">
                              <Link
                                href={`/cases?search=${encodeURIComponent(selected.case.protocolo || "")}`}
                              >
                                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                Abrir processo
                              </Link>
                            </Button>
                            <Button asChild size="sm" variant="outline" className="w-full">
                              <Link href="/tarefas">
                                <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                                Fila de contato
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </aside>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
