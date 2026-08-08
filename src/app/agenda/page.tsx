"use client";

/**
 * Agenda operacional — o que o Astrea tem e o Lexis ganhava só em fila.
 * Prazos da carteira + atendimentos da semana (sem anexos).
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
  isAtendidoNestaSemana,
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
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Loader2, RefreshCcw, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LegalCase } from "@/lib/case-logic";

function parsePrazo(c: LegalCase): Date | null {
  const raw = (c as any).proximoPrazo || (c as any).proximo_prazo || (c as any).dataPrazo || (c as any).prazo;
  if (!raw || raw === "-" || raw === "0") return null;
  try {
    if (/^\d{4}-\d{2}-\d{2}/.test(String(raw))) {
      const d = parseISO(String(raw).slice(0, 10));
      return isValid(d) ? startOfDay(d) : null;
    }
  } catch { /* */ }
  return parseUltimoAtendimento(String(raw));
}

export default function AgendaPage() {
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));

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
    const map: Record<string, { prazos: LegalCase[]; atendidos: LegalCase[] }> = {};
    for (const d of days) {
      map[format(d, "yyyy-MM-dd")] = { prazos: [], atendidos: [] };
    }
    for (const c of ativos) {
      const prazo = parsePrazo(c);
      if (prazo) {
        const key = format(prazo, "yyyy-MM-dd");
        if (map[key]) map[key].prazos.push(c);
      }
      const ret = parseUltimoAtendimento(c.ultimoRetorno || (c as any).ultimo_retorno);
      if (ret) {
        const key = format(ret, "yyyy-MM-dd");
        if (map[key]) map[key].atendidos.push(c);
      }
    }
    return map;
  }, [ativos, days]);

  const serie = useMemo(() => buildAtendimentosPorDiaSemana(ativos, anchor), [ativos, anchor]);
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
                <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" /> Agenda da semana
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {labelSemanaAtual(anchor)} · prazos da carteira + últimos atendimentos
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(weekStart, -7))}>
                ← Semana
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
                Hoje
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(weekStart, 7))}>
                Semana →
              </Button>
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              </Button>
            </div>
          </header>

          <div className="flex flex-wrap gap-2 text-xs">
            {serie.map((s) => (
              <Badge key={s.day} variant="outline">
                {s.day}: {s.atendimentos} atend.
              </Badge>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
              {days.map((d) => {
                const key = format(d, "yyyy-MM-dd");
                const cell = byDay[key] || { prazos: [], atendidos: [] };
                const isToday = isSameDay(d, hoje);
                return (
                  <div
                    key={key}
                    className={cn(
                      "rounded-2xl border p-3 min-h-[180px] flex flex-col gap-2",
                      isToday
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                    )}
                  >
                    <div className="flex items-baseline justify-between">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">
                        {format(d, "EEE", { locale: ptBR })}
                      </p>
                      <p className={cn("text-lg font-black tabular-nums", isToday && "text-primary")}>
                        {format(d, "dd")}
                      </p>
                    </div>
                    <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[280px]">
                      {cell.prazos.map((c) => (
                        <Link
                          key={`p-${c.protocolo}`}
                          href={`/cases?search=${encodeURIComponent(c.protocolo || "")}`}
                          className="block rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 px-2 py-1.5 text-[10px] hover:opacity-90"
                        >
                          <span className="font-black text-amber-800 dark:text-amber-200">PRAZO</span>
                          <p className="font-bold text-foreground truncate">{c.cliente}</p>
                          <p className="text-muted-foreground font-mono truncate">{c.protocolo}</p>
                        </Link>
                      ))}
                      {cell.atendidos.map((c) => (
                        <Link
                          key={`a-${c.protocolo}`}
                          href={`/cases?search=${encodeURIComponent(c.protocolo || "")}`}
                          className="block rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/50 px-2 py-1.5 text-[10px] hover:opacity-90"
                        >
                          <span className="font-black text-sky-800 dark:text-sky-200">ATENDIDO</span>
                          <p className="font-bold text-foreground truncate">{c.cliente}</p>
                        </Link>
                      ))}
                      {cell.prazos.length === 0 && cell.atendidos.length === 0 && (
                        <p className="text-[10px] text-muted-foreground text-center py-6">Livre</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Prazos vêm do campo de próximo prazo da carteira. Atendidos usam último retorno na semana.
            Clique no card para abrir o processo.
          </p>
        </div>
      </main>
    </div>
  );
}
