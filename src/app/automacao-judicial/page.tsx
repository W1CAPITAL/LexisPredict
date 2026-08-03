/**
 * Automação Judicial — catálogo de consultas por tribunal (eproc preferencial).
 * Apenas links públicos; não faz scrape.
 */
"use client";

import React, { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Scale, Search } from "lucide-react";
import {
  TODOS_TRIBUNAIS,
  getConsultaUrlForCnj,
  getFallbacksForCnj,
  getTribunalByCnj,
  codigoJusticaFromCnj,
} from "@/lib/tribunais-links";
import { ConsultaTribunalButton } from "@/components/tribunal/consulta-tribunal-button";
import { AnimatedIcon } from "@/components/ui/animated-icon";

export default function AutomacaoJudicialPage() {
  const [cnj, setCnj] = useState("");
  const [q, setQ] = useState("");

  const resolved = useMemo(() => {
    if (!cnj.trim()) return null;
    return {
      code: codigoJusticaFromCnj(cnj),
      tribunal: getTribunalByCnj(cnj),
      url: getConsultaUrlForCnj(cnj),
      fallbacks: getFallbacksForCnj(cnj),
    };
  }, [cnj]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return TODOS_TRIBUNAIS;
    return TODOS_TRIBUNAIS.filter(
      (t) =>
        t.sigla.toLowerCase().includes(term) ||
        t.nome.toLowerCase().includes(term) ||
        t.codigo.includes(term) ||
        t.sistema.includes(term)
    );
  }, [q]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-border/50 px-6 flex items-center gap-3 shrink-0">
          <AnimatedIcon icon={Scale} variant="glow" size={22} className="text-primary" />
          <div>
            <h1 className="text-sm font-black uppercase tracking-tight">Automação Judicial</h1>
            <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">
              Consulta pública · eproc preferencial
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
          <section className="rounded-2xl border border-border/50 bg-card p-4 space-y-3 max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Abrir consulta pelo CNJ
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                value={cnj}
                onChange={(e) => setCnj(e.target.value)}
                placeholder="0000000-00.0000.0.00.0000"
                className="h-11 rounded-xl font-mono text-sm max-w-md"
              />
              <ConsultaTribunalButton protocolo={cnj} label="Abrir tribunal" />
            </div>
            {resolved?.tribunal && (
              <p className="text-[11px] text-muted-foreground">
                {resolved.tribunal.sigla} · {resolved.tribunal.nome} · sistema{" "}
                <Badge variant="outline" className="text-[9px] uppercase">
                  {resolved.tribunal.sistema}
                </Badge>
                {resolved.code && (
                  <span className="ml-2 font-mono opacity-60">{resolved.code}</span>
                )}
              </p>
            )}
          </section>

          <section className="space-y-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar tribunal…"
                className="pl-10 h-11 rounded-xl"
              />
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((t) => (
                <div
                  key={t.codigo}
                  className="rounded-xl border border-border/40 bg-card p-4 space-y-2 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-sm">{t.sigla}</span>
                    <Badge variant="secondary" className="text-[8px] uppercase font-bold">
                      {t.sistema}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t.nome}</p>
                  <p className="text-[10px] font-mono opacity-50">{t.codigo}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[9px] font-black uppercase rounded-lg gap-1"
                      onClick={() => window.open(t.url, "_blank", "noopener,noreferrer")}
                    >
                      Principal <ExternalLink size={12} />
                    </Button>
                    {(t.alternativos || []).map((a, i) => (
                      <Button
                        key={i}
                        size="sm"
                        variant="ghost"
                        className="h-8 text-[9px] font-bold uppercase rounded-lg"
                        onClick={() => window.open(a.url, "_blank", "noopener,noreferrer")}
                      >
                        {a.label || a.sistema}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
