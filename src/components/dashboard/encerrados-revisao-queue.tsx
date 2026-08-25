"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldAlert, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildFilaEncerradosRevisao,
  type ItemEncerradoRevisao,
} from "@/lib/encerrados-revisao";
import type { LegalCase } from "@/lib/case-logic";

const toneClass: Record<string, string> = {
  critico: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  alto: "border-orange-500/40 bg-orange-500/10 text-orange-800 dark:text-orange-300",
  medio: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  info: "border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

type Props = {
  cases: LegalCase[];
  limit?: number;
  className?: string;
};

export function EncerradosRevisaoQueue({ cases, limit = 10, className }: Props) {
  const items = React.useMemo(
    () => buildFilaEncerradosRevisao(cases || [], limit),
    [cases, limit]
  );

  return (
    <section className={cn("premium-card overflow-hidden border border-amber-500/20", className)}>
      <div className="bg-amber-500/10 dark:bg-amber-500/5 px-6 sm:px-8 py-5 border-b border-amber-500/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ShieldAlert size={18} className="text-amber-700 dark:text-amber-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-[11px] font-black uppercase tracking-wide text-foreground">
              Encerrados a revisar
            </h3>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
              Fila de segurança · procedente · cumprimento · restore · novidade
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="h-8 px-3 rounded-xl font-black text-[10px] border-amber-600/40 text-amber-900 dark:text-amber-200 shrink-0"
        >
          {items.length} na fila
        </Badge>
      </div>

      {items.length === 0 ? (
        <div className="px-8 py-10 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Nenhum encerrado crítico pendente de revisão nesta carteira
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead className="bg-secondary/40 border-b border-border/20">
              <tr className="text-[9px] font-black uppercase text-muted-foreground/70 tracking-widest">
                <th className="px-6 sm:px-8 py-3">Cliente / CNJ</th>
                <th className="px-4 py-3">Por que revisar</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-6 sm:px-8 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {items.map((it: ItemEncerradoRevisao) => {
                const c = it.case;
                return (
                  <tr key={c.id || c.protocolo} className="hover:bg-amber-500/5 transition-colors">
                    <td className="px-6 sm:px-8 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-black uppercase tracking-wide">
                          {c.cliente || "—"}
                        </span>
                        <span className="text-[8px] font-mono opacity-50">{c.protocolo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[10px] font-black uppercase text-amber-900 dark:text-amber-200">
                        {it.motivoPrincipal}
                      </span>
                      {it.podeConfirmarAuto ? (
                        <p className="text-[8px] font-bold uppercase text-emerald-700 dark:text-emerald-400 mt-1">
                          Pode confirmar (improcedente + sem cumprimento)
                        </p>
                      ) : (
                        <p className="text-[8px] font-bold uppercase text-red-700 dark:text-red-400 mt-1">
                          Não confirmar às cegas — reabrir se houver valor
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[280px]">
                        {it.flags.slice(0, 4).map((f) => (
                          <span
                            key={f.id}
                            className={cn(
                              "text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border",
                              toneClass[f.tone] || toneClass.info
                            )}
                          >
                            {f.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 sm:px-8 py-4 text-right">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-xl text-[9px] font-black uppercase tracking-widest"
                      >
                        <Link href={`/processos?search=${encodeURIComponent(c.protocolo || "")}`}>
                          <Eye size={12} className="mr-1.5" />
                          Revisar
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-6 sm:px-8 py-3 border-t border-border/20 flex items-center justify-between bg-secondary/20">
        <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground max-w-[70%]">
          Procedente, cumprimento e restore do sistema sempre sobem aqui. Improcedente limpo pode só
          confirmar.
        </p>
        <Button asChild variant="ghost" className="h-8 text-[9px] font-black uppercase tracking-widest">
          <Link href="/processos">
            Processos da empresa <ArrowRight size={12} className="ml-1" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
